import io
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib import image_quality


def make_image_bytes(img, fmt="JPEG"):
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_noisy_photo_like_image(size=(400, 300), seed=0):
    """Simulates a real photo: continuous random noise, not flat color."""
    rng = np.random.default_rng(seed)
    arr = rng.integers(0, 255, (size[1], size[0], 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


def make_flat_illustration_like_image(size=(400, 300)):
    """Simulates a simple illustration: a handful of flat color blocks."""
    img = Image.new("RGB", size, (240, 240, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse([50, 50, 250, 200], fill=(255, 140, 0))
    draw.rectangle([260, 20, 380, 280], fill=(20, 120, 20))
    return img


class TestImageQualityBasics(unittest.TestCase):
    def test_dimensions_aspect_ratio_orientation(self):
        img = Image.new("RGB", (1600, 900), (100, 150, 200))
        report = image_quality.analyze(make_image_bytes(img))
        self.assertEqual(report.width, 1600)
        self.assertEqual(report.height, 900)
        self.assertAlmostEqual(report.aspect_ratio, 1600 / 900, places=2)
        self.assertEqual(report.orientation, "landscape")

    def test_portrait_and_square_orientation(self):
        portrait = image_quality.analyze(make_image_bytes(Image.new("RGB", (600, 900))))
        square = image_quality.analyze(make_image_bytes(Image.new("RGB", (800, 800))))
        self.assertEqual(portrait.orientation, "portrait")
        self.assertEqual(square.orientation, "square")

    def test_file_size_matches_actual_bytes(self):
        raw = make_image_bytes(Image.new("RGB", (500, 500), (10, 10, 10)))
        report = image_quality.analyze(raw)
        self.assertEqual(report.file_size_bytes, len(raw))


class TestSharpness(unittest.TestCase):
    def test_blurred_image_scores_lower_than_sharp_version(self):
        sharp = make_noisy_photo_like_image()
        blurred = sharp.filter(ImageFilter.GaussianBlur(radius=8))

        sharp_report = image_quality.analyze(make_image_bytes(sharp))
        blurred_report = image_quality.analyze(make_image_bytes(blurred))

        self.assertGreater(sharp_report.sharpness_score, blurred_report.sharpness_score)

    def test_flat_color_image_has_near_zero_sharpness(self):
        flat = Image.new("RGB", (400, 300), (128, 128, 128))
        report = image_quality.analyze(make_image_bytes(flat))
        self.assertLess(report.sharpness_score, 1.0)


class TestDuplicateDetection(unittest.TestCase):
    def test_identical_images_are_duplicates(self):
        img = make_noisy_photo_like_image(seed=1)
        r1 = image_quality.analyze(make_image_bytes(img))
        r2 = image_quality.analyze(make_image_bytes(img))
        self.assertTrue(image_quality.is_duplicate(r1.dhash, r2.dhash))

    def test_resized_recompressed_copy_still_flagged_duplicate(self):
        # This is the actual real-world case: the same underlying photo
        # shows up via Wikimedia at one derivative size and via GBIF
        # (re-serving an iNaturalist original) at a different size/
        # compression. A byte hash would call these different files;
        # dHash should still catch it.
        original = make_flat_illustration_like_image()
        resized_recompressed = original.resize((250, 188)).resize((400, 300))

        r1 = image_quality.analyze(make_image_bytes(original, fmt="JPEG"))
        r2 = image_quality.analyze(make_image_bytes(resized_recompressed, fmt="JPEG"))
        self.assertTrue(image_quality.is_duplicate(r1.dhash, r2.dhash))

    def test_genuinely_different_images_are_not_duplicates(self):
        img_a = make_noisy_photo_like_image(seed=1)
        img_b = make_flat_illustration_like_image()
        r1 = image_quality.analyze(make_image_bytes(img_a))
        r2 = image_quality.analyze(make_image_bytes(img_b))
        self.assertFalse(image_quality.is_duplicate(r1.dhash, r2.dhash))


class TestHeuristicsAreHonestlyLowConfidence(unittest.TestCase):
    """These don't assert the heuristics are *correct*. They can't be,
    that's the whole point documented in image_quality.py. They assert
    the heuristics behave the way the module claims they do, and that
    every result is explicitly labeled low-confidence rather than
    presented as a determination."""

    def test_flat_illustration_trips_the_low_unique_color_signal(self):
        # PNG, not JPEG: illustrations are almost always distributed as
        # PNG/SVG precisely because lossy compression suits flat color
        # regions badly. That's not just a test-fixture nicety. JPEG's
        # own DCT block artifacts at the edges between flat color
        # regions add real, if subtle, pixel noise that pushes the
        # unique-color count up. Feeding this same illustration through
        # JPEG instead of PNG measurably weakens the signal, which is
        # worth knowing if this heuristic is ever pointed at a source
        # that re-encodes everything to JPEG.
        illustration = make_flat_illustration_like_image()
        report = image_quality.analyze(make_image_bytes(illustration, fmt="PNG"))
        self.assertTrue(report.likely_illustration.flag)
        self.assertEqual(report.likely_illustration.confidence, "low")

    def test_noisy_photo_like_image_does_not_trip_illustration_signal(self):
        photo = make_noisy_photo_like_image()
        report = image_quality.analyze(make_image_bytes(photo))
        self.assertFalse(report.likely_illustration.flag)

    def test_watermark_signal_always_reports_confidence_low(self):
        # Whatever it decides, it must never claim to be sure.
        for img in (make_noisy_photo_like_image(), make_flat_illustration_like_image()):
            report = image_quality.analyze(make_image_bytes(img))
            self.assertEqual(report.possible_watermark.confidence, "low")
            self.assertIsInstance(report.possible_watermark.signal, float)


if __name__ == "__main__":
    unittest.main()
