import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import fetch_images


def make_photo(source, filename, url=None):
    return {
        "source": source, "filename": filename,
        "url": url or f"https://example.org/{filename}",
        "original_url": url or f"https://example.org/{filename}",
        "width": 1600, "height": 1200, "original_width": 3000, "original_height": 2250,
        "author": "someone", "license": "CC BY 4.0", "license_url": None,
        "source_url": "https://example.org/source",
    }


class TestTieredFallback(unittest.TestCase):
    def setUp(self):
        # Skip real download+hash in these tests. The fallback-chain
        # logic is what's under test here, not image_quality (that has
        # its own test file), and every mocked photo URL is fake anyway.
        patcher = patch("fetch_images.download_binary", return_value=None)
        self.addCleanup(patcher.stop)
        patcher.start()

    def test_stops_at_tier_1_when_wikimedia_alone_meets_the_minimum(self):
        animal = {
            "name": "Lion", "scientificName": "Panthera leo",
            "images": {"commonsCategory": "Panthera leo"},
        }
        wikimedia_photos = [make_photo("wikimedia", f"lion{i}.jpg") for i in range(5)]

        with patch("fetch_images.wikimedia_source.get_category_photos", return_value=wikimedia_photos) as wm, \
             patch("fetch_images.inaturalist_source.get_taxon_id") as inat_taxon, \
             patch("fetch_images.gbif_source.match_species") as gbif_match:
            result = fetch_images.process_animal(animal, min_photos=3, max_photos=5, force_relookup=False)

        self.assertEqual(result["status"], "sourced")
        self.assertEqual(result["photo_count"], 5)
        wm.assert_called_once()
        inat_taxon.assert_not_called()
        gbif_match.assert_not_called()

    def test_falls_through_to_inaturalist_when_wikimedia_is_short(self):
        animal = {
            "name": "Some Obscure Frog", "scientificName": "Genus obscurus",
            "images": {"commonsCategory": "Genus obscurus"},
        }
        wikimedia_photos = [make_photo("wikimedia", "frog1.jpg")]  # only 1, below min_photos=3
        inat_photos = [make_photo("inaturalist", "frog2.jpg"), make_photo("inaturalist", "frog3.jpg")]

        with patch("fetch_images.wikimedia_source.get_category_photos", return_value=wikimedia_photos), \
             patch("fetch_images.inaturalist_source.get_taxon_id", return_value=99999), \
             patch("fetch_images.inaturalist_source.get_observation_photos", return_value=inat_photos) as inat_photos_call, \
             patch("fetch_images.gbif_source.match_species") as gbif_match:
            result = fetch_images.process_animal(animal, min_photos=3, max_photos=5, force_relookup=False)

        self.assertEqual(result["status"], "sourced")
        self.assertEqual(result["photo_count"], 3)  # 1 wikimedia + 2 inaturalist
        inat_photos_call.assert_called_once()
        gbif_match.assert_not_called()  # tier 2 was enough, tier 3 never needed

    def test_falls_through_all_three_tiers_and_still_flags_needs_review_if_short(self):
        animal = {
            "name": "Extremely Obscure Species", "scientificName": "Rara avis",
            "images": {"commonsCategory": "Rara avis"},
        }
        with patch("fetch_images.wikimedia_source.get_category_photos", return_value=[]), \
             patch("fetch_images.inaturalist_source.get_taxon_id", return_value=55555), \
             patch("fetch_images.inaturalist_source.get_observation_photos", return_value=[]), \
             patch("fetch_images.gbif_source.match_species", return_value=77777), \
             patch("fetch_images.gbif_source.get_media", return_value=[make_photo("gbif", "rara1.jpg")]):
            result = fetch_images.process_animal(animal, min_photos=3, max_photos=5, force_relookup=False)

        self.assertEqual(result["status"], "needs-review")
        self.assertEqual(result["photo_count"], 1)
        self.assertIn("only found 1/3", result["reason"])

    def test_animal_with_no_category_and_no_wikidata_match_goes_straight_to_needs_review(self):
        animal = {"name": "Nonexistent Thing", "scientificName": None, "images": {}}
        with patch("fetch_images.wikidata_lookup.resolve_commons_category", return_value=(None, "no Wikidata item found for Wikipedia title 'Nonexistent Thing'")):
            result = fetch_images.process_animal(animal, min_photos=3, max_photos=5, force_relookup=False)

        self.assertEqual(result["status"], "needs-review")
        self.assertEqual(result["photo_count"], 0)
        self.assertIn("no Wikidata item found", result["reason"])


if __name__ == "__main__":
    unittest.main()
