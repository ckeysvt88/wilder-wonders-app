import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib import wikimedia_source, inaturalist_source, gbif_source
from lib.http import FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


def load(name):
    with open(FIXTURES / name) as f:
        return json.load(f)


class TestWikimediaSource(unittest.TestCase):
    def test_filters_out_svg_and_diagrams_keeps_real_photos(self):
        with patch("lib.wikimedia_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("commons_categorymembers_lion.json"))
            photos = wikimedia_source.get_category_photos("Panthera leo", limit=5)

        # Fixture has 4 files: a real photo, an SVG distribution map, a
        # second real photo, and a PNG skeleton diagram. Only the two
        # real photos should survive.
        self.assertEqual(len(photos), 2)
        filenames = [p["filename"] for p in photos]
        self.assertIn("Lion waiting in Namibia.jpg", filenames)
        self.assertIn("Lioness portrait Serengeti.jpg", filenames)
        self.assertNotIn("Lion distribution map.svg", filenames)
        self.assertNotIn("Lion skeleton diagram.png", filenames)

    def test_extracts_license_and_attribution_metadata(self):
        with patch("lib.wikimedia_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("commons_categorymembers_lion.json"))
            photos = wikimedia_source.get_category_photos("Panthera leo", limit=5)

        cc0_photo = next(p for p in photos if "Serengeti" in p["filename"])
        self.assertEqual(cc0_photo["license"], "CC0 1.0")
        self.assertEqual(cc0_photo["author"], "SerengetiPhotographer")

        ccbysa_photo = next(p for p in photos if "Namibia" in p["filename"])
        self.assertEqual(ccbysa_photo["license"], "CC BY-SA 3.0")
        # HTML in the Artist field should be stripped, not passed through raw
        self.assertEqual(ccbysa_photo["author"], "Ikiwaner")
        self.assertNotIn("<a", ccbysa_photo["author"])

    def test_requests_full_resolution_derivative_not_tiny_default_thumbnail(self):
        with patch("lib.wikimedia_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("commons_categorymembers_lion.json"))
            wikimedia_source.get_category_photos("Panthera leo", limit=5, min_width=1600)
            called_url = mock_get.call_args[0][0]
        self.assertIn("iiurlwidth=1600", called_url)

    def test_returns_empty_list_not_error_on_missing_category(self):
        with patch("lib.wikimedia_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=False, status=404, data=None, error="no such category")
            photos = wikimedia_source.get_category_photos("Nonexistent Category XYZ")
        self.assertEqual(photos, [])


class TestINaturalistSource(unittest.TestCase):
    def test_default_license_filter_excludes_nc_by_default(self):
        with patch("lib.inaturalist_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("inaturalist_observations_lion.json"))
            photos = inaturalist_source.get_observation_photos(42048, limit=5)

        # Fixture has one cc-by-nc photo and one cc-by photo. Default
        # licenses list excludes NC, so only the cc-by one should come back.
        self.assertEqual(len(photos), 1)
        self.assertEqual(photos[0]["license"], "CC-BY")

    def test_including_nc_explicitly_returns_both(self):
        with patch("lib.inaturalist_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("inaturalist_observations_lion.json"))
            photos = inaturalist_source.get_observation_photos(
                42048, limit=5, licenses=["cc0", "cc-by", "cc-by-sa", "cc-by-nc"]
            )
        self.assertEqual(len(photos), 2)

    def test_url_swapped_to_original_size_not_square_thumbnail(self):
        with patch("lib.inaturalist_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("inaturalist_observations_lion.json"))
            photos = inaturalist_source.get_observation_photos(
                42048, limit=5, licenses=["cc0", "cc-by", "cc-by-sa", "cc-by-nc"]
            )
        for photo in photos:
            self.assertNotIn("square", photo["url"])
            self.assertIn("original", photo["url"])


class TestGbifSource(unittest.TestCase):
    def test_species_match(self):
        with patch("lib.gbif_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("gbif_match_lion.json"))
            key = gbif_source.match_species("Panthera leo")
        self.assertEqual(key, 5219404)

    def test_checks_media_license_not_occurrence_license(self):
        with patch("lib.gbif_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data=load("gbif_occurrence_lion.json"))
            photos = gbif_source.get_media(5219404, limit=5)

        # Fixture has one CC-BY-licensed media item and one "All rights
        # reserved" media item. Only the CC-BY one should survive,
        # regardless of who recorded the underlying occurrence.
        self.assertEqual(len(photos), 1)
        self.assertIn("creativecommons.org/licenses/by", photos[0]["license"])

    def test_no_match_returns_none(self):
        with patch("lib.gbif_source.get_json") as mock_get:
            mock_get.return_value = FetchResult(ok=True, status=200, data={"matchType": "NONE"})
            key = gbif_source.match_species("Not A Real Species Name Xyzzy")
        self.assertIsNone(key)


if __name__ == "__main__":
    unittest.main()
