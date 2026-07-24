"""
wikimedia_source.py

Tier 1 of the fallback chain. Pulls photos from a specific Wikimedia
Commons category (resolved automatically via wikidata_lookup.py, or
supplied directly if someone already typed one into animals.json).

Two things this deliberately does NOT do, on purpose:

1. Doesn't cap the requested image width at Wikimedia's tiny default
   thumbnail size. "Thumbnail" in Wikimedia's API just means "a
   server-generated resized derivative at whatever width you ask
   for." It's not a fixed small size. This requests iiurlwidth=1600
   by default (configurable), which is what actually matters for
   "high quality" as a priority, not whether the word "thumbnail"
   appears in the request.

2. Doesn't treat every file in the category as a photo. Commons
   categories mix in distribution maps, skeleton diagrams, coats of
   arms, and SVG icons alongside real photographs. This filters by
   MIME type (excludes vector formats outright; illustrations on
   Commons are almost always SVG, so this is a cheap, reliable filter
   that a pixel-level "is this a photo or a drawing" classifier can't
   beat) and by filename keywords for the non-SVG false positives
   (maps, diagrams, skeletons).
"""

import re
from html import unescape

from lib.http import get_json

COMMONS_API = "https://commons.wikimedia.org/w/api.php"

SKIP_FILENAME_WORDS = [
    "distribution", "range map", "diagram", "logo", "skeleton",
    "icon", "coat of arms", "stamp", "map of", "taxonomy",
]
SKIP_MIME_TYPES = {"image/svg+xml", "application/pdf"}


def _looks_like_non_photo(filename, mime):
    if mime in SKIP_MIME_TYPES:
        return True
    lower = filename.lower()
    return any(word in lower for word in SKIP_FILENAME_WORDS)


def _strip_html(value):
    if not value:
        return None
    return unescape(re.sub(r"<[^>]+>", "", value)).strip()


def get_category_photos(category, limit=5, min_width=1600):
    """
    Returns up to `limit` photo dicts from Commons category `category`
    (no "Category:" prefix), each shaped:

    {
        "source": "wikimedia",
        "filename": str,
        "url": str,              # derivative at min_width (or original if smaller)
        "original_url": str,     # full-resolution original
        "width": int, "height": int,       # of the returned derivative
        "original_width": int, "original_height": int,
        "author": str or None,
        "license": str,          # short name, e.g. "CC BY-SA 4.0"
        "license_url": str or None,
        "source_url": str,       # the Commons file description page
    }

    Returns an empty list (not an error) if the category doesn't exist
    or has no photos. Callers should treat that as "move to the next
    tier," not as a crash.
    """
    url = (
        f"{COMMONS_API}?action=query&generator=categorymembers"
        f"&gcmtitle=Category:{_url_encode(category)}&gcmtype=file&gcmlimit=50"
        f"&prop=imageinfo&iiprop=url|size|mime|extmetadata|user"
        f"&iiurlwidth={min_width}&format=json&formatversion=2"
    )
    result = get_json(url)
    if not result.ok or not result.data:
        return []

    pages = result.data.get("query", {}).get("pages", [])
    photos = []

    for page in pages:
        imageinfo = page.get("imageinfo")
        if not imageinfo:
            continue
        info = imageinfo[0]
        filename = page.get("title", "").replace("File:", "")
        mime = info.get("mime", "")

        if _looks_like_non_photo(filename, mime):
            continue

        extmeta = info.get("extmetadata", {})
        license_short = extmeta.get("LicenseShortName", {}).get("value", "Unknown")
        license_url = extmeta.get("LicenseUrl", {}).get("value")
        artist = _strip_html(extmeta.get("Artist", {}).get("value"))

        photos.append({
            "source": "wikimedia",
            "filename": filename,
            "url": info.get("thumburl", info.get("url")),
            "original_url": info.get("url"),
            "width": info.get("thumbwidth", info.get("width")),
            "height": info.get("thumbheight", info.get("height")),
            "original_width": info.get("width"),
            "original_height": info.get("height"),
            "author": artist,
            "license": license_short,
            "license_url": license_url,
            "source_url": info.get("descriptionurl"),
        })

        if len(photos) >= limit:
            break

    return photos


def _url_encode(s):
    from urllib.parse import quote
    return quote(s.replace(" ", "_"))
