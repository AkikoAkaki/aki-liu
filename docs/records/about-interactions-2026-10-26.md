# About interactions — 2026-10-26

## Recovery

- Work branch: `refactor/about-interactions`.
- Recovery branch: `backup/about-before-refactor-2026-10-26` at `8def97b`.
- The recovery version includes the six selected photographs and the original About implementation.
- `main` remains at `ce80316cfb1f3e7f931d07331a9d18a5f5d9249d` during this work. Neither branch was pushed.

With a clean working tree, return to the old implementation while retaining the photo selection:

```powershell
git switch backup/about-before-refactor-2026-10-26
```

Return to the new implementation:

```powershell
git switch refactor/about-interactions
```

## Changes

- `data/about_photos.yaml` explicitly lists the six photographs, their order and neutral captions. It replaces captions previously assigned by index modulo seven.
- `layouts/about/list.html` keeps the vertical photo strip and existing card content. The strip has six slides, native previous/next controls and one accessible current image/status. Each card has a positioning shell around its existing surface.
- `assets/js/modules/about-gallery.js` uses Embla for vertical looping and centering. Keyboard, wheel and tap controls share one selection. A wheel burst includes its inertia tail; reversal begins a new gesture. Ctrl/Meta zoom and horizontal wheel events pass through. The current photo survives closing and media-query changes. Images decode before replacing the cover.
- `assets/js/modules/about-pinboard.js` uses GSAP Flip for moving cards into the pinboard and reflowing adjacent content. GSAP Draggable changes transforms instead of repeatedly updating layout positions. Crossing the desktop breakpoint cancels animations, releases drag handlers and restores the source slots. Reduced motion lands cards without a flight.
- `assets/css/about.css` separates position from surface rotation/hover. It removes competing hover transforms and drag z-index overrides. About content stays visible without JavaScript; reveal effects start only as elements enter the viewport.
- `assets/js/about.js` initializes the two interactions and the restrained entry effects. Other routes and the shared motion stylesheet remain unchanged.

The gallery's expanded viewport includes the visible area above and below its cover so Embla's loop boundaries fall outside the visible strip. The expanded strip is decorative for assistive technology; the base image, status and buttons expose the current photo.

## Dependencies

The files below are vendored locally in `assets/js/modules/` and bundled by Hugo only for About. No package manager or runtime CDN request is required. The upstream license notices are retained.

| File | Upstream |
| --- | --- |
| `vendor-embla-8.6.0.js` | [Embla 8.6.0 ESM](https://cdn.jsdelivr.net/npm/embla-carousel@8.6.0/esm/embla-carousel.esm.js), [MIT license](https://github.com/davidjerleke/embla-carousel/blob/v8.6.0/LICENSE) |
| `vendor-gsap-3.13.0.js` | [GSAP 3.13.0](https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js) |
| `vendor-flip-3.13.0.js` | [Flip 3.13.0](https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/Flip.min.js) |
| `vendor-draggable-3.13.0.js` | [Draggable 3.13.0](https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/Draggable.min.js) |

Implementation references: [Embla v8 options](https://www.embla-carousel.com/docs/v8/api/options), [GSAP Flip](https://gsap.com/docs/v3/Plugins/Flip/), [GSAP media-query lifecycle](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/), [Draggable](https://gsap.com/docs/v3/Plugins/Draggable/), [WAI carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

The dependency tradeoff is an About JavaScript bundle of approximately 57 KiB gzip, estimated by compressing the local production bundle. This is not a measured production transfer size or a performance improvement claim.

## Validation

- Hugo 0.152.2 production build and `scripts/check.ps1`: passed.
- Playwright with headless Edge, against the built site: six actual slides; keyboard selection and wrapping; real wheel input/reversal; zoom/horizontal-event pass-through; selected-slide centering across repeated loops; Escape and cover retention; mobile/desktop switching; both card flights; transform-based dragging and front ordering; breakpoint restoration and re-entry; reduced-motion mode; English About initialization.
- Additional cases in the same browser workflow: resizing during a flight; dragging a resume link without navigating; normal resume click; English course navigation with Enter; JavaScript-disabled content, cover and card dimensions. No page errors in the completed checks.
- Gallery and pinboard renders were visually inspected. Temporary verification scripts were kept outside the repository and removed afterward; no test files were added.
- Real touchpad inertia, physical touch input and Safari have not been verified. The mouse-wheel checks do not establish their feel. No runtime performance trace was used to claim a speedup.
