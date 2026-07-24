import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib import wikidata_lookup
from lib.http import FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


def load(name):
    with open(FIXTURES / name) as f:
        return json.load(f)


class TestWikidataLookup(unittest.TestCase):
    def test_get_wikidata_qid_from_wikipedia_title(self):
        with patch("lib.wikidata_lookup.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("wikipedia_pageprops_lion.json"))
            qid = wikidata_lookup.get_wikidata_qid("Lion")
        self.assertEqual(qid, "Q140")

    def test_get_commons_category_prefers_sitelink_over_p373(self):
        # Fixture has BOTH a commonswiki sitelink and a P373 claim, both
        # pointing at the same category. This just confirms the sitelink
        # path is actually taken, since that's the one Wikipedia's own
        # infobox code prefers.
        with patch("lib.wikidata_lookup.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("wikidata_entity_q140.json"))
            category = wikidata_lookup.get_commons_category("Q140")
        self.assertEqual(category, "Panthera leo")

    def test_get_commons_category_falls_back_to_p373_without_sitelink(self):
        data = load("wikidata_entity_q140.json")
        del data["entities"]["Q140"]["sitelinks"]["commonswiki"]
        with patch("lib.wikidata_lookup.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=data)
            category = wikidata_lookup.get_commons_category("Q140")
        self.assertEqual(category, "Panthera leo")

    def test_get_commons_category_returns_none_when_neither_exists(self):
        data = load("wikidata_entity_q140.json")
        del data["entities"]["Q140"]["sitelinks"]["commonswiki"]
        del data["entities"]["Q140"]["claims"]["P373"]
        with patch("lib.wikidata_lookup.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=data)
            category = wikidata_lookup.get_commons_category("Q140")
        self.assertIsNone(category)

    def test_resolve_commons_category_end_to_end(self):
        responses = [
            FetchResult(ok=True, status=200, data=load("wikipedia_pageprops_lion.json")),
            FetchResult(ok=True, status=200, data=load("wikidata_entity_q140.json")),
        ]
        with patch("lib.wikidata_lookup.get_json", side_effect=responses):
            category, reason = wikidata_lookup.resolve_commons_category("Lion")
        self.assertEqual(category, "Panthera leo")
        self.assertIsNone(reason)

    def test_resolve_commons_category_reports_reason_on_failure(self):
        with patch("lib.wikidata_lookup.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=False, status=404, data=None, error="not found")
            category, reason = wikidata_lookup.resolve_commons_category("Definitely Not A Real Article")
        self.assertIsNone(category)
        self.assertIn("no Wikidata item found", reason)


if __name__ == "__main__":
    unittest.main()
