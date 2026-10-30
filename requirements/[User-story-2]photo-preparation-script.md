# Story Decomposition: Photo Preparation Script

> Build-order item 5 in `plan.md`. It's the second story implemented, so it's file-numbered `User-story-2`.

## INVEST Analysis

### Abstract Task: "Photo Preparation Script"

**Analysis Dimensions**:
- **Core Responsibility**: Turn May & Jerrold's original pre-wedding photos (large camera files, organised in folders per chapter) into web-ready images plus a single photo list that the photobook page reads. All of it is done locally, in one command, before publishing.
- **Primary Operations**: Read the original folders, create resized web images, write the photo list, and report the total size. Re-running after adding, removing or changing photos keeps everything in sync.
- **Key Constraints**: The site is static, so photos must be prepared before publishing. The published site must stay well under GitHub Pages' 1 GB limit. Location data must never be published. Originals stay outside the repository. View-only, so no full-resolution originals are published.
- **Technical Complexity**: Medium. Image resizing, orientation, metadata stripping, and ordering by capture time.
- **Business Complexity**: Low. One operator (the couple), one command, a clear folder convention.

### INVEST Evaluation
- ✅ **Independent**: Needs only the folder convention. It doesn't depend on the page displaying photos (story "photo spreads" consumes its output later).
- ✅ **Negotiable**: Image sizes, quality and photo list details can be tuned.
- ✅ **Valuable**: The couple can prepare all their photos for the web safely and repeatably.
- ✅ **Estimable**: Well-understood scope.
- ✅ **Small**: 2–3 days.
- ✅ **Testable**: Every criterion can be checked by running the command on sample folders and inspecting the output.

**Conclusion**: Ready as-is (single story).

---

## [STORY-001-002] Photo Preparation Script Development

### Background
The photobook shows 150–400 curated photos from two pre-wedding shoots: **Outdoor** (4 locations, the first tab) and **Studio** (one set). The original photos are large camera files (often 5–25 MB each), which are too big for the web, and they may contain the GPS location where they were taken. A static site can't resize images or list folders by itself, so photos must be prepared before publishing.

The couple organises the originals on their computer in one folder per chapter: `Outdoor/<location name>/` and `Studio/`. This story gives them a single command that converts those folders into small, fast web images and a photo list describing every photo (its chapter, order and shape). The later "photo spreads", "shoot navigation" and "photo viewer" stories read that list to build the page.

Key points:
- The couple runs the command themselves, on their own computer, whenever they add or change photos.
- Folder names become the visible chapter names (e.g. a folder `Botanic Gardens` becomes the tab "Botanic Gardens"). An optional number prefix (e.g. `1 - Botanic Gardens`) controls the order of the locations and is not shown to guests.
- Photos appear in the order they were taken (camera timestamp), which tells each shoot as it happened.
- Images are produced in WebP format only, which every current browser supports.

### Business Value
- Provide the couple with a one-command, repeatable way to publish their photos to the photobook without manual resizing.
- Support fast loading on guests' phones by serving appropriately sized images instead of camera originals.
- Protect the couple's privacy by ensuring no location or camera metadata is published.
- Enable the photo spreads, navigation and viewer stories by producing the photo list they all read.

### Dependencies and Assumptions
- **Prerequisites**: None. (The hero and page shell story is already merged, but this story doesn't need it.)
- **Data assumptions**:
  - The originals live in a folder outside the website's repository, with exactly this layout: `<originals>/Outdoor/<location>/…` (up to 4 location folders, possibly more in future) and `<originals>/Studio/…`.
  - Photos are JPEG or PNG files exported by the photographer. They're a mix of portrait and landscape.
  - Most photos carry a camera timestamp. Some may not.
- **Integration points**: The output is consumed by the page in later stories. Outputs live in the website's repository so they're published with the site.
- **Business constraints**: The total published site must stay under GitHub Pages' 1 GB limit (target under 500 MB). No GPS or camera metadata may be published. View-only means no full-resolution originals are published. The command must run on the couple's Windows computer.

### Scope In
- One command that takes the originals folder, creates web-ready WebP images in three sizes per photo (small for the page, large for full-screen viewing, and a medium size in between). It corrects rotation and removes all metadata, including GPS.
- Writes a single photo list for the page: the shoots in the order Outdoor then Studio, the Outdoor locations in folder order, and the photos within each chapter in capture-time order. Each photo records its chapter, shape (width and height) and a readable description.
- Keeps outputs in sync on re-runs (new photos added, removed photos deleted, unchanged photos skipped) and finishes with a clear summary: number of photos per chapter, total output size, and a warning if the size budget is exceeded or any file was skipped.

### Scope Out
- Displaying photos on the page (photo spreads story).
- Navigation tabs and theme switching (shoot navigation story).
- Full-screen viewing (photo viewer story).
- Choosing or cropping the cover photo (story 6).
- Captions written by hand, favourites, and per-photo layout overrides. The photo list leaves room for them, but this story doesn't create them.
- HEIC/RAW camera formats and video.
- Uploading or publishing (handled by the normal git push to GitHub Pages).

### Acceptance Criteria

#### AC1: One command prepares all photos
**Given** an originals folder containing `Outdoor/Botanic Gardens/` (40 photos), `Outdoor/Marina/` (35), `Outdoor/Old Town/` (30), `Outdoor/Beach/` (45) and `Studio/` (60), for 210 photos in total
**When** the couple runs the preparation command, pointing it at that folder
**Then** each of the 210 photos is available on the website in three sizes as WebP images
**And** a photo list is produced that contains all 210 photos, grouped into Outdoor (4 locations) and Studio.

#### AC2: Shoots and locations appear in the agreed order
**Given** the originals above
**When** the photo list is produced
**Then** the Outdoor shoot comes before Studio
**And** the Outdoor locations are listed in alphabetical folder order (Beach, Botanic Gardens, Marina, Old Town)
**And** if the folders are renamed `1 - Marina`, `2 - Old Town`, `3 - Beach`, `4 - Botanic Gardens`, the order follows the numbers, and the names shown to guests are "Marina", "Old Town", "Beach" and "Botanic Gardens" (no number prefix).

#### AC3: Photos are ordered by when they were taken
**Given** the Marina folder has `IMG_0103.jpg` taken at 17:42, `IMG_0007.jpg` taken at 16:05 and `IMG_0050.jpg` taken at 17:10
**When** the photo list is produced
**Then** within Marina the order is `IMG_0007`, `IMG_0050`, `IMG_0103`.

#### AC4: Photos without a timestamp still have a stable place
**Given** a chapter where `scan-02.jpg` and `scan-01.jpg` have no camera timestamp, alongside timestamped photos
**When** the photo list is produced
**Then** the photos without a timestamp appear after the timestamped photos, ordered by filename (`scan-01`, then `scan-02`)
**And** running the command again produces exactly the same order.

#### AC5: Images are web-sized and correctly oriented
**Given** a 6000 × 4000 landscape original of 18 MB, and a portrait original stored sideways with a camera "rotate" flag
**When** the photos are prepared
**Then** the landscape photo's largest image is no more than 2400 pixels on its long edge, the smallest is no more than about 640 pixels, and the largest file is well under 1 MB
**And** the portrait photo appears upright in every size, and its recorded shape is portrait (taller than wide)
**And** a photo smaller than a target size is never enlarged.

#### AC6: No location or camera data is published
**Given** an original photo containing GPS coordinates, camera model and date in its metadata
**When** the photo is prepared
**Then** none of the published images contain GPS coordinates or any other photo metadata.

#### AC7: Each photo has a readable description
**Given** a photo from the "Botanic Gardens" location and a photo from Studio
**When** the photo list is produced
**Then** their descriptions read "May & Jerrold at Botanic Gardens" and "May & Jerrold in the studio", so screen readers announce something meaningful.

#### AC8: Re-running keeps everything in sync and is quick
**Given** the 210 photos were prepared earlier
**When** the couple adds 5 photos to Studio, deletes 2 from Beach, and runs the command again
**Then** only the 5 new photos are processed (the unchanged ones are skipped and reported as unchanged)
**And** the images for the 2 deleted photos are removed from the website
**And** the photo list now contains 213 photos.

#### AC9: Summary and size budget
**Given** the command has finished
**When** the couple reads its output
**Then** it shows the number of photos per chapter, how many were new, unchanged or removed, and the total size of the prepared images (e.g. "Total: 213 photos, 142 MB")
**And** if the total exceeds 500 MB it shows a clear warning that the site is approaching GitHub Pages' 1 GB limit.

#### AC10: Unexpected files and folders are handled clearly
**Given** the originals folder also contains `Studio/notes.txt`, a `Studio/._IMG_0001.jpg` system file, an `Outdoor/Extras/` folder that is empty, and a corrupt `Outdoor/Marina/broken.jpg`
**When** the command runs
**Then** the text and system files are ignored silently
**And** the empty folder doesn't create an empty chapter
**And** the corrupt photo is skipped with a message naming the file, and all other photos are still prepared.

#### AC11: Wrong folder layout is reported, not guessed
**Given** the couple points the command at a folder that contains neither an `Outdoor` nor a `Studio` folder
**When** the command runs
**Then** it stops without changing anything on the website and explains the expected layout (`Outdoor/<location>/` and `Studio/`).

#### AC12: Originals are never modified
**Given** any run of the command
**When** it finishes (successfully or not)
**Then** the original photo files and folders are byte-for-byte unchanged.

#### Non-Functional Expectations
- Preparing 400 photos from scratch should finish within a few minutes on a typical laptop. A re-run with no changes should finish in seconds.
- The command must be runnable on Windows with a single documented setup step.
- The output must be identical on repeated runs with the same inputs, so git only sees real changes.
