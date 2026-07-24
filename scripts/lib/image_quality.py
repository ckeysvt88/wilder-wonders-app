"""
image_quality.py

Per-image analysis: the metrics that are just measurements (dimensions,
aspect ratio, file size, sharpness, duplicate hash) versus the two
that were asked for but don't have a reliable cheap answer
(illustration detection, watermark detection). Both categories are
implemented, but the second category is implemented honestly, with
its actual accuracy stated rather than dressed up as a solved problem.

WHY WATERMARK AND ILLUSTRATION DETECTION ARE FLAGGED, NOT TRUSTED:
Reliably telling "photo" from "illustration," or "clean" from
"watermarked," from pixels alone is a real computer vision problem:
the kind of thing that historically needed a trained classifier, not
a hand-rolled heuristic. What's below will catch some obvious cases
and miss or misfire on plenty of others. Both come back as
{flag, confidence: "low", signal: <the raw number>} rather than a bare
True/False, specifically so a human reviewing the output can see the
actual number and judge for themselves rather than trusting a label
that looks more certain than it is.

The heuristics matter less than they'd sound like they should, though,
because the real fix is upstream: Wikimedia, iNaturalist, and GBIF
photos essentially never carry overlay watermarks (that's a stock-photo
and scraped-web problem), and the illustration filtering that actually
works (excluding SVG/vector files outright) already happens in
wikimedia_source.py before an image gets here. These two checks exist
mainly as a safety net for anything that slips through, or for a future
source that isn't as clean as the current three.
"""

import io
from dataclasses import dataclass, asdict
from typing import Optional

from PIL import Image, ImageFilter
import numpy as np

LAPLACIAN_KERNEL = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1)


@dataclass
class HeuristicSignal:
    flag: bool
    confidence: str  # always "low" for the two heuristic checks below
    signal: float     # the raw underlying number, so a human can judge for themselves


@dataclass
class ImageQualityReport:
    width: int
    height: int
    aspect_ratio: float
    orientation: str  # "landscape" | "portrait" | "square"
    file_size_bytes: int
    format: str
    sharpness_score: float
    dhash: str
    likely_illustration: HeuristicSignal
    possible_watermark: HeuristicSignal

    def to_dict(self):
        d = asdict(self)
        return d


def analyze(image_bytes: bytes) -> ImageQualityReport:
    img = Image.open(io.BytesIO(image_bytes))
    img.load()  # force full decode now, so a truncated/corrupt download
    # fails here with a clear exception instead of later during hashing

    width, height = img.size
    orientation = "square" if width == height else ("landscape" if width > height else "portrait")
    fmt = img.format or "unknown"

    rgb = img.convert("RGB")
    sharpness = _compute_sharpness(rgb)
    dhash = _compute_dhash(rgb)

    return ImageQualityReport(
        width=width,
        height=height,
        aspect_ratio=round(width / height, 3) if height else 0.0,
        orientation=orientation,
        file_size_bytes=len(image_bytes),
        format=fmt,
        sharpness_score=round(sharpness, 1),
        dhash=dhash,
        likely_illustration=_detect_possible_illustration(rgb),
        possible_watermark=_detect_possible_watermark(rgb),
    )


def _compute_sharpness(rgb_img: Image.Image) -> float:
    """Variance of the Laplacian, a standard, well-established blur proxy.
    Low variance = flat/blurry, high variance = lots of real edge detail.
    Not calibrated to an absolute pass/fail threshold here on purpose:
    what counts as 'sharp enough' varies by subject (a frog on a leaf vs.
    a python's scale texture), so this is meant for *relative* ranking
    across candidate photos of the same animal, not an absolute cutoff."""
    gray = rgb_img.convert("L")
    edges = gray.filter(LAPLACIAN_KERNEL)
    arr = np.asarray(edges, dtype=np.float64)
    # Pillow leaves a 1px border unfiltered rather than computing a
    # partial convolution there, so that border holds original pixel
    # values sitting next to a fully-filtered interior. On a truly flat
    # image that mismatch alone produces nonzero variance that has
    # nothing to do with sharpness. Crop it out before measuring.
    if arr.shape[0] > 4 and arr.shape[1] > 4:
        arr = arr[2:-2, 2:-2]
    return float(arr.var())


def _compute_dhash(rgb_img: Image.Image, hash_size: int = 8) -> str:
    """Difference hash for near-duplicate detection. Resistant to minor
    recompression/resizing, unlike a simple byte or MD5 hash of the file,
    which matters here since the same underlying photo often shows up at
    different derivative sizes across Wikimedia, iNaturalist, and GBIF
    (GBIF frequently just re-serves an iNaturalist original)."""
    resized = rgb_img.convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
    pixels = np.asarray(resized, dtype=np.int16)
    diff = pixels[:, 1:] > pixels[:, :-1]
    bits = diff.flatten()
    hash_int = 0
    for bit in bits:
        hash_int = (hash_int << 1) | int(bit)
    return format(hash_int, f"0{hash_size * hash_size // 4}x")


def hamming_distance(hash_a: str, hash_b: str) -> int:
    return bin(int(hash_a, 16) ^ int(hash_b, 16)).count("1")


def is_duplicate(hash_a: str, hash_b: str, threshold: int = 5) -> bool:
    """threshold=5 out of 64 bits is a commonly-used dHash cutoff. Two
    photos of the literally same shot at different crops/exposures
    usually land under 5; two different photos of the same species
    standing in a similar pose usually land well above it. Worth
    tuning against your own fixtures if you see false positives."""
    return hamming_distance(hash_a, hash_b) <= threshold


def _detect_possible_illustration(rgb_img: Image.Image) -> HeuristicSignal:
    """Coarse signal only. Downsamples and counts unique colors: flat
    illustrations and vector art re-exported as PNG/JPEG tend to have far
    fewer unique colors than a photo, which almost always has continuous
    gradients, sensor noise, and JPEG compression artifacts pushing the
    count up. A close-up macro shot against a single blurred-out
    background color is the main false-positive case."""
    # NEAREST, not the default interpolating resize. Bicubic/lanczos
    # resampling blends colors along every boundary between flat
    # regions, which manufactures hundreds of fake intermediate colors
    # and defeats the whole point of this check on exactly the images
    # it's meant to catch.
    small = rgb_img.resize((100, 100), Image.NEAREST)
    pixel_array = np.asarray(small).reshape(-1, 3)
    unique_ratio = len(np.unique(pixel_array, axis=0)) / len(pixel_array)
    flagged = unique_ratio < 0.05
    return HeuristicSignal(flag=flagged, confidence="low", signal=round(unique_ratio, 4))
    # Note: JPEG's own lossy compression adds real pixel noise at the
    # boundaries between flat color regions (block/DCT artifacts), which
    # raises the unique-color count and weakens this signal specifically
    # for illustrations that happen to be saved as JPEG rather than
    # PNG/SVG. Confirmed empirically while writing test_image_quality.py:
    # the same synthetic illustration measured ~0.0003 unique-color ratio
    # as PNG versus ~0.063 through JPEG, enough to flip the flag. Not a
    # large practical problem here since SVG is already filtered out
    # upstream in wikimedia_source.py and most illustrations that do
    # reach this point are PNG, but worth knowing if this heuristic is
    # ever pointed at a source that re-encodes everything to JPEG.


def _detect_possible_watermark(rgb_img: Image.Image) -> HeuristicSignal:
    """Coarse signal only. Compares edge density in the four corners
    against edge density in the center. Text/logo overlays usually sit
    in a corner and are locally busier than the corner of a typical
    nature photo. Textured natural backgrounds (grass, bark, gravel,
    rippled water) in a corner will trigger this just as often as an
    actual watermark, which is the main reason this is confidence:
    'low' rather than a real detector."""
    gray = rgb_img.convert("L")
    edges = np.asarray(gray.filter(ImageFilter.FIND_EDGES), dtype=np.float64)
    h, w = edges.shape
    corner_h, corner_w = max(1, h // 8), max(1, w // 8)

    corners = [
        edges[0:corner_h, 0:corner_w],
        edges[0:corner_h, w - corner_w:w],
        edges[h - corner_h:h, 0:corner_w],
        edges[h - corner_h:h, w - corner_w:w],
    ]
    corner_density = float(np.mean([c.mean() for c in corners]))

    cy0, cy1 = h // 4, 3 * h // 4
    cx0, cx1 = w // 4, 3 * w // 4
    center_density = float(edges[cy0:cy1, cx0:cx1].mean()) or 1.0

    ratio = corner_density / center_density
    flagged = ratio > 1.8
    return HeuristicSignal(flag=flagged, confidence="low", signal=round(ratio, 3))
