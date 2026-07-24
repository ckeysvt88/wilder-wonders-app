"""
inaturalist_source.py

Tier 2 of the fallback chain. Only queried when Wikimedia's category
didn't produce enough photos on its own. This is what actually closes
the coverage gap for the long tail as the roster grows toward 2,000+
species. Wikimedia Commons is deep for famous animals and thin for a
lot of specific frogs, regional reptiles, and less-charismatic fish;
iNaturalist's citizen-science volume covers almost anything with a
scientific name, at the cost of much more variable photo quality.

Two real constraints this bakes in, both confirmed against current
iNaturalist docs rather than assumed:

- Rate limit: iNaturalist throttles at 100 req/min hard, and explicitly
  asks integrators to stay at 60/min or lower and under 10,000/day.
  Community bug reports show even 60/min sometimes draws 429s in
  practice, so this errs conservative and lets lib/http.py's backoff
  do the rest.
- License filtering happens on the PHOTO, not the observation.
  Observations and their photos can carry different licenses, and
  iNaturalist's own default (when a user opts in to licensing at all)
  is CC-BY-NC (non-commercial). The `photo_license` param filters on
  the photo specifically; DEFAULT_LICENSES below excludes NC variants
  because whether Wild Wonders counts as commercial hasn't been
  settled. Loosen this once that's decided, not before.
"""

from lib.http import get_json

INAT_API = "https://api.inaturalist.org/v1"

# CC0 / CC-BY / CC-BY-SA only, by default. Excludes NC and ND variants.
# See the module docstring for why. Change this list, not the filter
# logic, if Wild Wonders is confirmed non-commercial.
DEFAULT_LICENSES = ["cc0", "cc-by", "cc-by-sa"]

MIN_INTERVAL_SECONDS = 1.1  # keeps bulk runs under ~54/min, below the documented 60/min ask


def get_taxon_id(scientific_name):
    """Scientific name -> iNaturalist taxon ID for the best species-rank match."""
    url = f"{INAT_API}/taxa?q={_url_encode(scientific_name)}&rank=species&per_page=5"
    result = get_json(url, min_interval=MIN_INTERVAL_SECONDS)
    if not result.ok or not result.data:
        return None

    results = result.data.get("results", [])
    for taxon in results:
        if taxon.get("name", "").lower() == scientific_name.lower():
            return taxon["id"]
    return results[0]["id"] if results else None


def get_observation_photos(taxon_id, limit=5, licenses=None):
    """
    Returns up to `limit` photo dicts from research-grade observations
    of `taxon_id`, filtered to `licenses` (default: CC0/CC-BY/CC-BY-SA).

    Shape matches wikimedia_source.get_category_photos() so the
    orchestrator can treat every tier identically:
    {source, filename, url, original_url, width, height,
     original_width, original_height, author, license, license_url,
     source_url}
    """
    licenses = licenses or DEFAULT_LICENSES
    url = (
        f"{INAT_API}/observations?taxon_id={taxon_id}&photos=true"
        f"&quality_grade=research&photo_license={','.join(licenses)}"
        f"&per_page={min(limit * 3, 30)}&order_by=votes&order=desc"
    )
    result = get_json(url, min_interval=MIN_INTERVAL_SECONDS)
    if not result.ok or not result.data:
        return []

    photos = []
    seen_photo_ids = set()

    for obs in result.data.get("results", []):
        for photo in obs.get("photos", []):
            license_code = photo.get("license_code")
            if license_code not in licenses:
                continue
            if photo["id"] in seen_photo_ids:
                continue
            seen_photo_ids.add(photo["id"])

            dims = photo.get("original_dimensions") or {}
            # iNaturalist photo URLs use a size token ("square", "small",
            # "medium", "large", "original") in place of the default.
            # Swap it for "original" to get full resolution rather than
            # whatever size happened to come back by default.
            original_url = photo.get("url", "").replace("square", "original")

            photos.append({
                "source": "inaturalist",
                "filename": f"inat-{photo['id']}.jpg",
                "url": original_url,
                "original_url": original_url,
                "width": dims.get("width"),
                "height": dims.get("height"),
                "original_width": dims.get("width"),
                "original_height": dims.get("height"),
                "author": photo.get("attribution"),
                "license": license_code.upper() if license_code else "Unknown",
                "license_url": _license_url(license_code),
                "source_url": f"https://www.inaturalist.org/observations/{obs.get('id')}",
            })

            if len(photos) >= limit:
                return photos

    return photos


def _license_url(code):
    mapping = {
        "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
        "cc-by": "https://creativecommons.org/licenses/by/4.0/",
        "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
        "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
    }
    return mapping.get(code)


def _url_encode(s):
    from urllib.parse import quote
    return quote(s)
