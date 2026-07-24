"""
pexels_source.py

Tier 1: a curated stock photo search, tried before Wikimedia now. This
exists specifically because Wikimedia Commons categories are crowd
-maintained, not reviewed, and can contain stray miscategorized files
even when the category itself is correctly resolved (confirmed on
Lion: commonsCategory was exactly right, "Panthera leo", and Wikimedia
still surfaced an unrelated photo and a multi-image collage alongside
genuinely good ones). A real search engine matching a query to relevant
content is a different, generally more reliable mechanism than pulling
everything tagged into a category page, though it comes with an
opposite weakness: strong for commercially popular animals, thin for
obscure ones nobody photographs for stock.

License: the Pexels License, free for commercial and non-commercial
use, no attribution legally required (cleaner than Wikimedia's CC-BY/
CC-BY-SA, which does require it). Confirmed directly against Pexels'
current help docs and API documentation, not from memory.

Requires a free API key, read from the PEXELS_API_KEY environment
variable. If it's not set, get_photos_for_query returns an empty list
rather than raising, so the pipeline just falls through to Wikimedia,
the same as if Pexels had no results for that animal.
"""

import os
import urllib.parse

from .http import get_json

SEARCH_URL = "https://api.pexels.com/v1/search"

# 200 requests/hour, 20,000/month by default per Pexels' own published
# limits. Generous relative to a weekly cron that only touches new or
# needs-review animals, so no aggressive spacing needed here the way
# iNaturalist's tighter 60/min guidance requires.
MIN_INTERVAL_SECONDS = 0.5


def _api_key():
    return os.environ.get("PEXELS_API_KEY")


def get_photos_for_query(query, limit=5):
    """
    Searches Pexels by plain-language query (the animal's common name,
    not its scientific name: this is a stock-photo search engine, not
    a taxonomic database, and "lion" matches how actual photographers
    tag their own work far better than "Panthera leo" would).
    """
    key = _api_key()
    if not key:
        return []

    url = f"{SEARCH_URL}?query={urllib.parse.quote_plus(query)}&per_page={min(limit, 80)}&size=medium"
    result = get_json(url, min_interval=MIN_INTERVAL_SECONDS, extra_headers={"Authorization": key})
    if not result.ok or not result.data:
        return []

    photos = []
    for item in result.data.get("photos", []):
        src = item.get("src", {})
        download_url = src.get("original") or src.get("large2x") or src.get("large")
        if not download_url:
            continue
        photos.append({
            "source": "pexels",
            "url": download_url,
            "width": item.get("width"),
            "height": item.get("height"),
            "author": item.get("photographer"),
            "license": "Pexels License",
            "license_url": "https://www.pexels.com/license/",
            "source_url": item.get("url"),
        })
        if len(photos) >= limit:
            break
    return photos
