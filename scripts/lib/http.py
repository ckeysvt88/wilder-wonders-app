"""
http.py

One shared request function for every source module. This exists so
User-Agent policy, retry/backoff, and rate-limit spacing are handled
in exactly one place instead of copy-pasted into four fetch scripts.

Every source in this pipeline (Wikimedia, iNaturalist, GBIF) publishes
some version of the same three rules: identify yourself, back off on
429/Retry-After, don't fire requests in parallel at them. This module
is where all three get enforced.
"""

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

# Replace the contact email before running this against real APIs at
# any real volume. Wikimedia and iNaturalist both call this out
# explicitly, and Wikimedia has been actively tightening enforcement
# against generic/uncontactable User-Agents through 2026.
CONTACT = "ckeysvt88+pics@gmail.com"
USER_AGENT = f"WildWondersFetchScript/2.0 (kids' animal encyclopedia PWA; contact: {CONTACT})"


@dataclass
class FetchResult:
    ok: bool
    status: Optional[int]
    data: Optional[dict]
    error: Optional[str] = None


def get_json(url, min_interval=1.0, max_retries=4, timeout=20, extra_headers=None):
    """
    GETs a URL and parses JSON, with:
      - a compliant User-Agent header
      - a minimum delay before the request (rate limiting, not just
        reacting to 429s after the fact)
      - exponential backoff on 429 and 5xx, honoring Retry-After when
        the server sends one

    extra_headers merges in on top of the base headers, for sources
    that need something the others don't (Pexels' Authorization key,
    for instance) without duplicating this retry/backoff logic in a
    second request function.

    Returns a FetchResult rather than raising, so a single bad species
    doesn't kill a batch run over 2,000 animals. The caller decides
    whether to skip, retry later, or flag for manual review.
    """
    time.sleep(min_interval)
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)

    delay = 2.0
    for attempt in range(max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                return FetchResult(ok=True, status=resp.status, data=json.loads(body))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries:
                retry_after = e.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else delay
                time.sleep(wait)
                delay *= 2
                continue
            return FetchResult(ok=False, status=e.code, data=None, error=str(e))
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2
                continue
            return FetchResult(ok=False, status=None, data=None, error=str(e))

    return FetchResult(ok=False, status=None, data=None, error="max retries exceeded")


def download_binary(url, timeout=30):
    """Downloads raw bytes (for the image-quality analysis step, which needs
    actual pixels, not just metadata). Returns bytes or None on failure."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return None
