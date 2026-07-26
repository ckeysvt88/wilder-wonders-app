---
name: adding-animals
description: Use when the user asks to add a new animal to the WildWonders app, says photos for an animal are already in the photos/ folder, or otherwise wants a new entry created in animals.json.
---

# Adding Animals to WildWonders

## Overview

Repo-specific, end-to-end workflow for onboarding one new animal: resize its
photos, write its full `animals.json` entry, validate, commit, and push.
Run the whole thing to completion in one pass.

## Pre-authorized: no check-ins mid-workflow

The user has pre-authorized this exact workflow — resize, fill schema,
validate, commit, push — **to run without asking for confirmation at any
step, including the git push.** This authorization is scoped only to this
add-an-animal workflow; it does not extend to any other git or destructive
action in this repo.

Do not ask "should I commit and push?" or "should I resize these?" — the
answer is always yes. The only case worth stopping for is an `id` collision
(step 3) or a missing/corrupt photo file.

## Procedure

1. **Find the photos.** In `photos/`, find the files for this animal:
   `<id><n>.<ext>` (e.g. `otter1.jpg`, `otter2.jpg`, `otter3.heic`). The
   shared prefix is the `id` — it must be lowercase-kebab-case and is what
   `app.js`'s `photoImg()` uses to build `./photos/${id}${n}.${ext}` lookups.
   If the user names a specific common name (e.g. "add a deer"), match it to
   whichever species the photo prefix implies, and use the fuller/scientific
   common name for `name` (e.g. `deer` id → "White-Tailed Deer") the same
   way `fox` → "Red Fox" and not just "Fox".

2. **Convert + resize every photo** to the site standard: max dimension
   1200px, JPEG quality 80 (same as `resize-photos.ps1`). Convert any
   non-JPEG source (HEIC, PNG, etc.) to `.jpg` first — browsers can't render
   HEIC, and `PHOTO_EXTS` in `app.js` tries `.jpg` first. Preserve EXIF
   orientation if present. Overwrite in place; if the extension changed,
   delete the original. Quick recipe (Pillow, with `pillow-heif` installed
   for HEIC sources):

   ```python
   from PIL import Image
   def resize_save(path, max_dim=1200, quality=80):
       img = Image.open(path).convert('RGB')
       w, h = img.size
       scale = min(1.0, max_dim / max(w, h))
       img = img.resize((max(1,int(w*scale)), max(1,int(h*scale))), Image.LANCZOS)
       img.save(path, 'JPEG', quality=quality, optimize=True)
   ```

   Always check resulting file sizes — originals arrive multi-MB and must
   not ship unresized (this has happened repeatedly; treat it as a hard
   gate, not optional cleanup).

3. **Check for an id collision** in `animals.json`. If the `id` already
   exists, stop and ask — this is the one case where you check in.

4. **Write the full entry**, modeled on an existing similar animal (find one
   with `grep`/read for a close relative — e.g. a canid for a new fox, a
   cervid for a new deer — and match its structure exactly). Shape:

   ```json
   {
     "id": "otter",
     "name": "River Otter",
     "sciName": "Lontra canadensis",
     "categories": ["mammals"],
     "conservationStatus": "Least Concern",
     "nicknames": [],
     "quickFacts": {
       "height": "", "weight": "", "length": "", "lifespan": "",
       "diet": "", "habitat": "", "speed": "", "range": ""
     },
     "funFact": "",
     "blurb": "",
     "mapRegions": ["North America"],
     "mapCaption": "",
     "traits": {
       "size": "Small", "dangerLevel": "Low", "canFly": false,
       "canSwim": true, "canClimb": false, "canBePet": false,
       "nocturnal": false, "endangered": false, "diet": "Omnivore",
       "habitatTag": "Freshwater"
     },
     "relatedIds": [],
     "images": [{"source": "existing"}, {"source": "existing"}, {"source": "existing"}]
   }
   ```

   One `images` entry per photo file found in step 1, in file-number order.
   Use `{"source": "existing"}` (no attribution fields) unless the user
   supplies real photo credit — that's the existing convention for
   user-supplied, non-Pexels photos throughout the file.

   `relatedIds` must reference `id`s that already exist in `animals.json`;
   pick 2-3 genuinely related animals (same habitat, similar species, or
   predator/prey).

   Constrain free-choice fields to the values already used in the file
   (grep `animals.json` to confirm current values before relying on the
   list below, in case the schema has grown since this was written):

   | Field | Valid values |
   |---|---|
   | `categories[]` | mammals, birds, amphibians, fish, sharks, ocean-animals, crocodiles-alligators, insects, arachnids, farm-animals, pets, rainforest, desert, arctic, endangered-species, nocturnal-animals, weird-animals, snakes, lizards, turtles-tortoises |
   | `mapRegions[]` | Africa, Antarctica, Arctic Ocean, Asia, Atlantic Ocean, Europe, Indian Ocean, North America, Oceania, Pacific Ocean, South America, Worldwide |
   | `traits.size` | Small, Medium, Large, Giant |
   | `traits.dangerLevel` | Low, Medium, High |
   | `traits.diet` / `quickFacts.diet` | Carnivore, Herbivore, Omnivore |
   | `traits.habitatTag` | Arctic & Tundra, Desert, Farm, Forest, Freshwater, Grassland, Ocean, Rainforest, Savanna |

   An invented value outside these lists won't error, it'll just silently
   break a filter or the world-map highlight — treat the tables as a hard
   constraint, not a suggestion.

5. **Validate** before writing anything to disk permanently: JSON parses,
   every `relatedIds` entry exists as an `id` elsewhere in the file, every
   `categories` entry is in the valid list.

   ```python
   import json
   d = json.load(open('animals.json', encoding='utf-8'))
   ids = {a['id'] for a in d['animals']}
   cats = {c['id'] for c in d['categories']}
   new = next(a for a in d['animals'] if a['id'] == '<new-id>')
   assert all(r in ids for r in new['relatedIds'])
   assert all(c in cats for c in new['categories'])
   ```

6. **Insert the entry** near a related animal for readability (array order
   is not alphabetical and has no functional effect — confirmed by
   `app.js` iterating the full array regardless of position).

7. **Commit and push** — `animals.json` plus the resized photo files, one
   commit, descriptive message. Push immediately after. No confirmation
   step (see "Pre-authorized" above).

## Common Mistakes

- Shipping unresized originals (multi-MB) — always resize before touching
  `animals.json`, not after.
- Inventing a category/mapRegion/trait value not in the tables above.
- Stopping to ask about the commit or push.
- Leaving a non-JPEG file (HEIC especially) referenced implicitly by not
  converting it — `PHOTO_EXTS` cascades through extensions but HEIC isn't
  in the list at all, so it silently falls through to the placeholder art.
