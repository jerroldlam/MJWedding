# Story Decomposition: Hero Cover & Page Shell

## INVEST Analysis

### Abstract Task: "Hero Cover & Page Shell"

**Analysis Dimensions**:
- **Core Responsibility**: Give guests a beautiful first impression of May & Jerrold's pre-wedding photobook. Establish the single page, the visual identity (fonts, colours, accent), and the empty sections that later stories fill with photos.
- **Primary Operations**: View the cover, scroll or tap through to the photos area, share the link.
- **Key Constraints**: Fully static and hosted on GitHub Pages under a sub-path. Must be unlisted (not indexed by search engines). Must look right on phones and desktops. One `index.html` that loads separate scripts. Outdoor shoot is the default, so the page opens in the light ivory theme.
- **Technical Complexity**: Low. Static markup, styles and minimal script.
- **Business Complexity**: Low. A single viewing flow with no data and no user input.

### INVEST Evaluation
- ✅ **Independent**: Needs no other story. It is the foundation the others build on.
- ✅ **Negotiable**: Cover wording, spacing and placeholder styling can be adjusted.
- ✅ **Valuable**: Delivers a shareable, on-brand landing page immediately.
- ✅ **Estimable**: Well-understood scope.
- ✅ **Small**: 1–2 days.
- ✅ **Testable**: Every criterion can be checked in a browser on a phone and a desktop.

**Conclusion**: Ready as-is (single story).

---

## [STORY-001-001] Hero Cover & Page Shell Development

### Background
May & Jerrold are publishing photos from two pre-wedding shoots (Outdoor across 4 locations, and Studio) as a private-feeling, link-only photobook for family and friends. The first thing guests see is a full-screen cover with the couple's names. It sets the tone for the whole site.

This story creates the page itself and its visual identity: the Cormorant Garamond + Jost typography, the ivory and dark colour themes, and the champagne gold accent. It also lays out the empty sections that later stories fill: shoot navigation (story 3), photo spreads (story 2) and the full-screen viewer (story 4). Everything built later depends on this shell, so it comes first.

Key points:
- Guests mostly open the link on phones from a family chat, so the mobile first impression matters most.
- No dates appear anywhere on the site (couple's decision).
- The real cover photo may not be ready yet, so the cover must look finished without one.

### Business Value
- Provide family and friends with an elegant, readable landing page for May & Jerrold's pre-wedding photobook.
- Support sharing the photobook privately via a link, without it appearing in search results.
- Enable every later story (photos, navigation, viewer) to plug into a consistent page and visual style.

### Dependencies and Assumptions
- **Prerequisites**: None.
- **Data assumptions**: The couple's names are "May & Jerrold". No dates are shown. A cover photo may be supplied later. Until then, a neutral warm placeholder background is used.
- **Integration points**: GitHub Pages hosting at a sub-path address (`https://<user>.github.io/<repo>/`). Web fonts from Google Fonts.
- **Business constraints**: The site must stay unlisted (not indexed). It must be fully static, with no server and no build step. It follows the decisions recorded in `plan.md` (per-shoot theme, fonts, accent, view-only).

### Scope In
- The single page with its cover: "May & Jerrold" as the main heading, a small "Pre-wedding photobook" line beneath it, and a "View photos" cue that takes the guest to the photos area.
- The site-wide visual identity: the two fonts, the light ivory theme (shown by default) and the dark theme (defined but not yet used), the champagne gold accent, and readable text sizes on phone and desktop.
- Empty, clearly structured sections for shoot navigation, the photo area and a footer, ready for later stories, plus the browser tab title, link-preview title and description, and the "do not index" marker.

### Scope Out
- Photos, photo layouts and the image processing script (story 2 / 5).
- Shoot and location tabs and switching to the dark Studio theme (story 3).
- The full-screen photo viewer (story 4).
- An "Our Story" section and the photographer credit (photographer's name not yet provided).
- A link-preview image (needs the final cover photo and the site's public address).
- A custom domain.

### Acceptance Criteria

#### AC1: Cover shows the couple's names on arrival
**Given** a guest opens the photobook link on any device
**When** the page loads
**Then** a cover fills the first screen, showing "May & Jerrold" as the largest text in an elegant serif typeface, centred, with "Pre-wedding photobook" in small, widely spaced capitals beneath it
**And** no date appears anywhere on the page.

#### AC2: "View photos" cue takes the guest onward
**Given** a guest is looking at the cover
**When** they tap or click "View photos"
**Then** the page moves smoothly down to the start of the photos area, which sits directly below the cover.

#### AC3: Looks right on a phone
**Given** a guest opens the link on a phone 375 pixels wide (e.g. iPhone SE/mini size)
**When** the cover is shown
**Then** "May & Jerrold" fits within the screen width with comfortable side margins (wrapping onto two lines at most)
**And** the page cannot be scrolled sideways
**And** small text such as "Pre-wedding photobook" and "View photos" is still clearly readable without zooming.

#### AC4: Looks right on a desktop
**Given** a guest opens the link in a desktop browser window 1440 × 900 pixels
**When** the cover is shown
**Then** the cover fills exactly the visible window height, the names are centred horizontally and vertically, and no large empty gaps or stretched text appear.

#### AC5: Works on notched phones
**Given** a guest opens the link on a phone with a notch or rounded corners (e.g. iPhone 15) in portrait or landscape
**When** the cover is shown
**Then** no text or the "View photos" cue is hidden behind the notch, rounded corners or home bar.

#### AC6: Cover looks finished without a cover photo
**Given** no cover photo has been supplied yet
**When** a guest opens the page
**Then** the cover shows a calm, warm-toned background with the names fully legible, and it looks deliberate rather than broken (no broken-image icon, no blank white box).

#### AC7: Opens in the light ivory theme with champagne accents
**Given** the Outdoor shoot is the default
**When** a guest opens the page
**Then** the background is warm ivory with dark charcoal text, and small decorative details (e.g. the divider or the "View photos" underline) are champagne gold.

#### AC8: Readable even if the special fonts fail to load
**Given** a guest's connection blocks or fails to load web fonts
**When** the page loads
**Then** the names still appear in a standard serif typeface and the other text in a standard sans-serif typeface, with all text visible immediately (no invisible text while waiting).

#### AC9: Browser tab and shared link show the couple's names
**Given** a guest has the page open, or pastes the link into WhatsApp or iMessage
**When** they look at the browser tab or the link preview
**Then** the title reads "May & Jerrold" and the preview description reads "Our pre-wedding photobook".

#### AC10: Not listed in search engines
**Given** the site is published on GitHub Pages
**When** a search engine visits the page
**Then** the page tells search engines not to index it or follow its links.

#### AC11: Works at the GitHub Pages sub-path
**Given** the site is published at `https://<user>.github.io/<repo>/`
**When** a guest opens that address
**Then** all styles, fonts and scripts load (nothing appears unstyled or missing), exactly as when previewed locally.

#### AC12: Respects reduced-motion settings
**Given** a guest has "reduce motion" turned on in their phone or computer settings
**When** they view the cover and tap "View photos"
**Then** nothing on the cover animates, and the page jumps directly to the photos area instead of scrolling smoothly.

#### AC13: Keyboard and screen-reader friendly
**Given** a guest navigates with a keyboard or uses a screen reader
**When** they move through the cover
**Then** "View photos" can be reached with Tab and activated with Enter, shows a visible focus outline, and the names are announced as the page's main heading.

#### Non-Functional Expectations
- The cover should appear almost instantly on a typical 4G phone connection. The page shell is lightweight.
- Text contrast meets common readability guidelines on the ivory background.
