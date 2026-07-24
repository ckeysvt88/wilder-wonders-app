#!/usr/bin/env python3
"""
fetch_images.py

Downloads real animal photos and saves them as local files, matching
app.js's own loading convention exactly: photos/{id}{n}.{ext}, where n
is a 1-indexed position (1, 2, 3...) and the extension cascades through
jpg/jpeg/png/webp on the frontend if the first guess 404s.

    Tier 1: Pexels (curated stock photo search, needs PEXELS_API_KEY)
    Tier 2: Wikimedia Commons (category auto-resolved via Wikidata)
    Tier 3: iNaturalist (research-grade, permissively licensed photos)
    Tier 4: GBIF occurrence media (broadest species coverage, last resort)

Pexels moved ahead of Wikimedia after Lion came back from Wikimedia
with a stray unrelated photo and a multi-photo collage alongside good
ones, confirmed to be noise within a correctly-resolved Commons
category rather than a resolution bug. A search engine matching query
to content is a different, generally cleaner mechanism than pulling
everything tagged into a crowd-maintained category page, though it
trades away Wikimedia's depth on species nobody photographs for stock.
Wikimedia stays as a real fallback tier for exactly that reason, not
a leftover.

This checks the actual photos/ folder before fetching anything, not
animals.json. Photos placed by hand never touch the JSON, only the
folder, so JSON state alone can't be trusted to know what's already
done. A slot that already has a real file on disk is left untouched,
never re-fetched, never overwritten, regardless of --force.

Runs outside the Claude.ai build sandbox. That environment has no route
to any of these APIs, only package registries. Run this locally, in
Claude Code, or in the GitHub Actions workflow.

Usage:
    python3 fetch_images.py                    # every animal, skips what's already sourced
    python3 fetch_images.py --id lion          # just one
    python3 fetch_images.py --force            # keep filling toward max_photos even if
                                                # already at min_photos
    python3 fetch_images.py --min-photos 3 --max-photos 5
    python3 fetch_images.py --force-relookup   # re-resolve commonsCategory even if cached

Resizing is intentionally not done here. That's a separate existing
step (resize-photos.ps1 / Claude Code), left alone on purpose rather
than duplicated.

Before running at any real volume: open lib/http.py and replace the
placeholder contact email in the User-Agent string. Wikimedia and
iNaturalist both check for this, and Wikimedia has been tightening
enforcement against generic User-Agents through 2026. Separately, set
the PEXELS_API_KEY environment variable to enable Tier 1; without it,
Pexels is silently skipped and the pipeline starts at Wikimedia instead.
"""

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from lib import wikidata_lookup, wikimedia_source, inaturalist_source, gbif_source, pexels_source, image_quality
from lib.http import download_binary

DATA_PATH = Path(__file__).parent.parent / "animals.json"
PHOTOS_DIR = Path(__file__).parent.parent / "photos"
MIN_PHOTOS_DEFAULT = 3
MAX_PHOTOS_DEFAULT = 5

# Matches app.js's own PHOTO_EXTS cascade exactly, so a slot this script
# considers "already filled" is checked the same way the browser checks it.
PHOTO_EXTS_TO_CHECK = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"]

# Pillow's format string -> the extension app.js's cascade actually checks for it.
FORMAT_TO_EXT = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def load_animals():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_animals(data):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def existing_photo_slots(animal_id, max_slots):
    """
    Checks disk, not JSON, for which numbered slots (1..max_slots)
    already have a real image file. Returns {slot_number: Path}.
    """
    found = {}
    for n in range(1, max_slots + 1):
        for ext in PHOTO_EXTS_TO_CHECK:
            candidate = PHOTOS_DIR / f"{animal_id}{n}.{ext}"
            if candidate.exists():
                found[n] = candidate
                break
    return found


def _detect_extension(raw_bytes):
    """Cheap header read, not a full quality pass: just enough to save
    the file under the extension that actually matches its real format,
    rather than assuming everything downloaded is a JPEG."""
    try:
        fmt = Image.open(io.BytesIO(raw_bytes)).format
    except Exception:
        fmt = None
    return FORMAT_TO_EXT.get(fmt, "jpg")


def process_animal(animal, min_photos, max_photos, force, force_relookup, analyze_quality=True):
    """
    Runs one animal through the tiered fallback chain, downloading and
    saving real photo files. Mutates animal["images"] to reflect
    whatever is actually on disk when this returns, whether that's from
    this run, a previous run, or Craig's own manual downloads. Does not
    write animals.json itself; the caller does that once per run so a
    mid-run crash doesn't leave a half-written file.
    """
    animal_id = animal["id"]
    name = animal["name"]

    existing = existing_photo_slots(animal_id, max_photos)
    slot_meta = {n: {"source": "existing"} for n in existing}

    if len(existing) >= min_photos and not force:
        animal["images"] = [slot_meta[n] for n in sorted(slot_meta)]
        return {"name": name, "status": "sourced", "photo_count": len(existing), "tiers": [], "reason": None}

    empty_slots = [n for n in range(1, max_photos + 1) if n not in existing]
    room = len(empty_slots)
    collected = []
    seen_hashes = []
    tier_log = []

    def total_count():
        return len(existing) + len(collected)

    def add_candidates(new_photos, tier_name):
        added = 0
        for photo in new_photos:
            if len(collected) >= room:
                break
            raw = download_binary(photo["url"])
            if not raw:
                continue
            photo_hash = None
            if analyze_quality:
                try:
                    report = image_quality.analyze(raw)
                    photo["_quality"] = report.to_dict()
                    photo_hash = report.dhash
                except Exception:
                    photo_hash = None
                if photo_hash and any(image_quality.is_duplicate(photo_hash, h) for h in seen_hashes):
                    continue
                if photo_hash:
                    seen_hashes.append(photo_hash)
            photo["_bytes"] = raw
            photo["_tier"] = tier_name
            collected.append(photo)
            added += 1
        tier_log.append(f"{tier_name}: +{added} (have {total_count()}/{max_photos})")

    # Tier 1: Pexels. Needs no Commons category, so it's tried before
    # ever resolving one; if Pexels alone reaches min_photos, the
    # Wikidata lookup below is skipped entirely, one less API call for
    # the majority of animals this tier already handles well.
    if room > 0:
        add_candidates(pexels_source.get_photos_for_query(name, limit=room), "pexels")

    category = animal.get("commonsCategory")
    remaining = room - len(collected)
    if remaining > 0 and (total_count() < min_photos or force):
        if not category or force_relookup:
            resolved, reason = wikidata_lookup.resolve_commons_category(name)
            if resolved:
                category = resolved
                animal["commonsCategory"] = resolved
            elif not category:
                category = None

        # Tier 2: Wikimedia
        if category:
            add_candidates(wikimedia_source.get_category_photos(category, limit=remaining), "wikimedia")

    # Tier 3: iNaturalist
    remaining = room - len(collected)
    if remaining > 0 and (total_count() < min_photos or force) and animal.get("sciName"):
        taxon_id = inaturalist_source.get_taxon_id(animal["sciName"])
        if taxon_id:
            add_candidates(inaturalist_source.get_observation_photos(taxon_id, limit=remaining + 2), "inaturalist")

    # Tier 4: GBIF
    remaining = room - len(collected)
    if remaining > 0 and (total_count() < min_photos or force) and animal.get("sciName"):
        usage_key = gbif_source.match_species(animal["sciName"])
        if usage_key:
            add_candidates(gbif_source.get_media(usage_key, limit=remaining + 2), "gbif")

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    for slot_n, photo in zip(empty_slots, collected):
        ext = _detect_extension(photo["_bytes"])
        dest = PHOTOS_DIR / f"{animal_id}{slot_n}.{ext}"
        with open(dest, "wb") as f:
            f.write(photo["_bytes"])
        meta = {
            "source": photo.get("_tier", "unknown"),
            "author": photo.get("author"),
            "license": photo.get("license"),
            "license_url": photo.get("license_url"),
            "source_url": photo.get("source_url"),
        }
        if "_quality" in photo:
            meta["quality"] = photo["_quality"]
        slot_meta[slot_n] = meta

    final_count = len(slot_meta)
    animal["images"] = [slot_meta[n] for n in sorted(slot_meta)]
    status = "sourced" if final_count >= min_photos else "needs-review"

    return {
        "name": name,
        "status": status,
        "photo_count": final_count,
        "tiers": tier_log,
        "reason": None if status == "sourced" else f"only found {final_count}/{min_photos} minimum across all 4 tiers",
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch animal photos via Pexels -> Wikimedia -> iNaturalist -> GBIF fallback")
    parser.add_argument("--id", help="Only process this animal id")
    parser.add_argument("--min-photos", type=int, default=MIN_PHOTOS_DEFAULT)
    parser.add_argument("--max-photos", type=int, default=MAX_PHOTOS_DEFAULT)
    parser.add_argument("--force-relookup", action="store_true", help="Re-resolve commonsCategory even if already cached")
    parser.add_argument("--force", action="store_true", help="Keep trying to fill toward max-photos even if already at min-photos. Never overwrites an existing file.")
    parser.add_argument("--no-quality-analysis", action="store_true", help="Skip sharpness/duplicate analysis (still downloads; dedup across sources won't run)")
    args = parser.parse_args()

    data = load_animals()
    animals = data["animals"]
    if args.id:
        animals = [a for a in animals if a["id"] == args.id]
        if not animals:
            sys.exit(f"No animal with id '{args.id}'")

    results = []
    for animal in animals:
        result = process_animal(
            animal, args.min_photos, args.max_photos, args.force, args.force_relookup,
            analyze_quality=not args.no_quality_analysis,
        )
        results.append(result)
        detail = ", ".join(result.get("tiers") or []) or (result.get("reason") or "already had enough")
        print(f"{result['name']}: {result['status']} ({result['photo_count']} photos): {detail}")

    save_animals(data)

    sourced = [r for r in results if r["status"] == "sourced"]
    needs_review = [r for r in results if r["status"] == "needs-review"]
    print(f"\n{len(sourced)} sourced, {len(needs_review)} need manual review out of {len(results)} processed.")
    if needs_review:
        print("Needs review:")
        for r in needs_review:
            print(f"  - {r['name']}: {r['reason']}")


if __name__ == "__main__":
    main()
