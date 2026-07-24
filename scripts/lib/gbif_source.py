"""
gbif_source.py

Tier 3: the last automated fallback before an animal gets queued for
manual review. GBIF aggregates occurrence records (and their media)
from museums, herbaria, and other providers, including iNaturalist
itself, so there's real overlap with tier 2. It earns its place as a
separate tier for two reasons: its aggregate species coverage is
broader than any single source, and (this is the part worth being
careful about) GBIF's docs explicitly warn that "occurrence images
may be licensed under more restrictive terms than other occurrence
data." The occurrence record's own license is not a reliable proxy for
the license on its media; this checks the media object's license
field specifically, every time.

No API key needed for search (unlike Smithsonian). Rate limiting is
load-based rather than a fixed published number. GBIF returns 429
under load and explicitly recommends the bulk Download API instead of
looped search calls for anything that would take over 15 minutes. For
a periodic top-up of a few dozen species a week, search is the right
tool; it would not be for a one-time cold-start backfill across all
2,000 species at once (see FEASIBILITY_STUDY.md).
"""

from lib.http import get_json

GBIF_API = "https://api.gbif.org/v1"
ACCEPTED_LICENSES = {
    "CC0_1_0", "CC_BY_4_0", "CC_BY_SA_4_0",
    "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
    "http://creativecommons.org/licenses/by/4.0/legalcode",
    "http://creativecommons.org/licenses/by-sa/4.0/legalcode",
}


def match_species(scientific_name):
    """Scientific name -> GBIF usageKey, or None if no confident match."""
    url = f"{GBIF_API}/species/match?name={_url_encode(scientific_name)}"
    result = get_json(url, min_interval=0.5)
    if not result.ok or not result.data:
        return None
    if result.data.get("matchType") == "NONE":
        return None
    return result.data.get("usageKey")


def get_media(usage_key, limit=5):
    """
    Returns up to `limit` photo dicts for `usage_key`, filtered to
    ACCEPTED_LICENSES and checked against the media item's own license
    field (not the occurrence's), per GBIF's own caveat about the two
    not necessarily matching.
    """
    url = f"{GBIF_API}/occurrence/search?taxonKey={usage_key}&mediaType=StillImage&limit=50"
    result = get_json(url, min_interval=0.5)
    if not result.ok or not result.data:
        return []

    photos = []
    seen_urls = set()

    for occ in result.data.get("results", []):
        for media in occ.get("media", []):
            if media.get("type") != "StillImage":
                continue
            license_val = (media.get("license") or "").strip()
            if not _license_accepted(license_val):
                continue
            identifier = media.get("identifier")
            if not identifier or identifier in seen_urls:
                continue
            seen_urls.add(identifier)

            photos.append({
                "source": "gbif",
                "filename": identifier.split("/")[-1][:80],
                "url": identifier,
                "original_url": identifier,
                "width": None,   # GBIF media records rarely include dimensions up front
                "height": None,  # image_quality.py fills these in after download
                "original_width": None,
                "original_height": None,
                "author": media.get("creator") or occ.get("recordedBy"),
                "license": license_val or "Unknown",
                "license_url": license_val if license_val.startswith("http") else None,
                "source_url": f"https://www.gbif.org/occurrence/{occ.get('key')}",
            })

            if len(photos) >= limit:
                return photos

    return photos


def _license_accepted(license_val):
    if not license_val:
        return False
    normalized = license_val.strip().rstrip("/")
    return any(normalized == accepted.rstrip("/") for accepted in ACCEPTED_LICENSES)


def _url_encode(s):
    from urllib.parse import quote
    return quote(s)
