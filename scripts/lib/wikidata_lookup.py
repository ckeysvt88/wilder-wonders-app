"""
wikidata_lookup.py

This is the actual answer to "does searching Wikipedia first produce
more reliable results than searching Commons directly." Short version:
yes, because it removes ambiguity, and here's the mechanism rather
than a vibe.

A raw Commons text search for a common name matches on whatever words
appear in file names, descriptions, and categories. For "Lion" that
pulls in the Lions Club, the Detroit Lions, heraldic lions, and the MGM
logo alongside actual Panthera leo photos. For something like "Green
Tree Frog," a common name shared by multiple species on different
continents (Hyla cinerea in the US, Litoria caerulea in Australia), a
text search can't tell which one you mean at all. It'll return both,
mixed together, with nothing marking which photo belongs to which
species.

Going through Wikipedia first sidesteps this because a Wikipedia
article title already disambiguates ("Green and black poison dart
frog" vs "Australian green tree frog"), and every Wikipedia article
about a species is backed by exactly one Wikidata item, which is where
the Commons category lives.

Lookup order (this mirrors what Wikipedia's own infobox code does;
see Module:Wikidata_label on Meta-Wiki):
  1. The Wikidata item's direct "commonswiki" sitelink. Most species
     items have one; it's the most current and most trustworthy source
     because it's literally the same link Commons and Wikidata agree on.
  2. The P373 "Commons category" statement, as a fallback for items
     that have the claim but no direct sitelink.
  3. Neither exists -> return None. The caller should queue the animal
     for manual review rather than guess at a category name.

Two network calls per species (Wikipedia title -> QID, then Wikidata
entity data), both cacheable. See CACHE NOTE at the bottom.
"""

import re

from lib.http import get_json

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_ENTITY_URL = "https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"


def get_wikidata_qid(wikipedia_title):
    """Wikipedia article title -> Wikidata QID (e.g. 'Lion' -> 'Q140')."""
    url = (
        f"{WIKIPEDIA_API}?action=query&prop=pageprops&ppprop=wikibase_item"
        f"&titles={urllib_quote(wikipedia_title)}&format=json&formatversion=2"
    )
    result = get_json(url)
    if not result.ok or not result.data:
        return None

    pages = result.data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return None

    return pages[0].get("pageprops", {}).get("wikibase_item")


def get_commons_category(qid):
    """
    Wikidata QID -> Commons category name (no 'Category:' prefix), or
    None if the item has neither a commonswiki sitelink nor a P373 claim.
    """
    result = get_json(WIKIDATA_ENTITY_URL.format(qid=qid))
    if not result.ok or not result.data:
        return None

    entities = result.data.get("entities", {})
    entity = entities.get(qid)
    if not entity:
        return None

    # 1. Direct sitelink: the modern, preferred path.
    sitelinks = entity.get("sitelinks", {})
    commons_sitelink = sitelinks.get("commonswiki")
    if commons_sitelink and commons_sitelink.get("title"):
        title = commons_sitelink["title"]
        return re.sub(r"^Category:", "", title)

    # 2. P373 claim: fallback for items without a direct sitelink.
    claims = entity.get("claims", {})
    p373 = claims.get("P373")
    if p373:
        try:
            return p373[0]["mainsnak"]["datavalue"]["value"]
        except (KeyError, IndexError, TypeError):
            pass

    return None


def resolve_commons_category(wikipedia_title):
    """
    The one function callers actually use: Wikipedia article title ->
    Commons category name, or None (with a reason) if it can't be
    resolved automatically.

    Returns (category_or_none, reason_if_none)
    """
    qid = get_wikidata_qid(wikipedia_title)
    if not qid:
        return None, f"no Wikidata item found for Wikipedia title '{wikipedia_title}'"

    category = get_commons_category(qid)
    if not category:
        return None, f"Wikidata item {qid} has no commonswiki sitelink or P373 claim"

    return category, None


def urllib_quote(s):
    from urllib.parse import quote
    return quote(s.replace(" ", "_"))


# CACHE NOTE: resolve_commons_category rarely changes for a given
# species once resolved (a Commons category name basically never
# changes), so the orchestrator (fetch_images.py) only calls this for
# animals that don't already have a commonsCategory in animals.json.
# Once resolved, it's written back into the JSON and never looked up
# again unless --force-relookup is passed. This is what keeps a
# 2,000-species pipeline from re-running 2,000 lookups on every run.
# most runs only touch the handful of newly added animals.
