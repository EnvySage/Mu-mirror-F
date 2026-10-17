# Mirror · Blue hour UI

2026-10-16. User-approved direction: Persona 3 Reload inspired UI, using P3R characters, freely generated supporting art, and a Git checkpoint after each module. Continue Vue 3 / Pinia / existing API contracts.

## Design

- Midnight `#06123f`, ocean `#0737bb`, electric blue `#1762ff`, cyan `#50edfa`, pink `#ee246a`, paper `#f8fbff`.
- Barlow Condensed for large, slanted English display type and numbers; system Chinese sans serif for reading.
- A blue water stage, a compact dark navigation rail, sharp cyan selection shapes, and white reading surfaces. Character art carries the composition; content remains live HTML.
- Mirror focuses on recent accomplishments, progress, emotional state, and unfinished tasks. Historical snapshots remain distinct from the rolling 30-day statistics.
- Responsive desktop/mobile layouts, keyboard focus, reduced-motion support, visible loading/error/empty states. Preserve review, snapshot comparison, streaming chat, upload confirmation, and delete protection.

## Assets

P3R character images are original ATLUS / SEGA assets from the [official site](https://p3re.jp/en/), included at the user's request. Provenance is retained here; these are not represented as original Mirror characters.

- `public/art/p3r/protagonist.webp`: `/en/resources/img/top/character_modal/img_character1_f234d553552dd807c323dfecb0663805.webp`
- `public/art/p3r/protagonist-battle.webp`: `/en/resources/img/top/character_modal/img_character1_battle_a100337e6e24dd2f2e97b63e3de283f3.webp`
- `public/art/p3r/aigis.webp`: `/en/resources/img/top/character_modal/img_character8_73249c3f489f16fab594b3beb77a330e.webp`
- `public/art/p3r/yukari.webp`: `/en/resources/img/top/character_modal/img_character2_b7a5d0380d83442589cd0fdb356577aa.webp`

`public/art/water-surface.webp` was generated with built-in imagegen, then encoded as WebP. The exact generation prompt is preserved in [art-prompts.md](art-prompts.md).

Barlow Condensed fonts are locally served, sourced through Google Fonts, under the SIL Open Font License in `public/art/fonts/OFL.txt`.

## Checkpoints

1. Shared theme, navigation, fonts, and visual assets.
2. Mirror stage, recent progress, statistics, and snapshot history.
3. Records and calendar.
4. Dialogue, archive, settings, authentication, and interaction polish.

Build with `npm run build`. Local verification artifacts and fixture servers belong in ignored `.verify/`; production API behavior must not depend on fixtures.

## Verification — 2026-10-16

- Production build passes. No UI or chart dependencies added.
- All six authenticated routes checked at 375px and 1440px: no horizontal overflow, no broken character images, no console errors in normal operation. Login/register also checked at desktop and 375px.
- Exercised record status filters, quick capture and save, keyboard record opening, closing details on navigation, calendar day selection and matching records, historical snapshots, returning to latest, two-snapshot comparison, new conversation and streamed fixture response, archive filtering and confirmation form, settings editing and section navigation, and registration validation.
- Mirror empty-data state shows a first-record action. Simulated API failures show unknown metrics as dashes and provide retry controls. Retrying reloads the profile and snapshot history together; statistics retry independently.
- Local backend was unavailable during visual verification. A separate ignored local fixture server supplies clearly marked sample data for the preview; no fixtures, authentication bypasses, or mock switches are added to production source.
- Screenshots and measurement reports are saved under ignored `.verify/` in the local checkout. The legacy coordination import-check script was absent; Vite compilation and navigation through every route validate imports instead.


## Revision — portraits and motion, 2026-10-16

User feedback: remove the game character cutouts and make movement carry more of the P3R influence.

- Removed all rendered character cutouts from Mirror, Records, Calendar, Dialogue, and authentication. The independent water background remains. Old cutout assets are retained as unused historical sources; no page loads them.
- Rebalanced headline widths and calendar/login typography around open water, oversized lettering, and abstract rings.
- Navigation now uses a shared sliding cyan selection block. Page changes use two diagonal color wipes, a brief destination label, and a clipped incoming view (about 600ms total).
- Added clipped title/copy entrances, directional calendar month transitions, and cut-in desktop writing/detail panels. Motion layers do not intercept clicks; system reduced-motion settings disable the route wipe and shorten transitions.
- Verification: production build and diff whitespace check pass. Browser preview verifies portrait count zero, route wipe CSS applied, page content restored after navigation, September/October calendar navigation, and mobile horizontal overflow checks. Preview uses the existing local sample-data fixture, not a live backend.


## Writing and daily reflections — 2026-10-16

- Replaced the small writing modal with a wide two-column workspace (up to 1100px): date and water artwork on the left, a large quiet writing surface on the right. Mobile uses a tall sheet, retaining the counter and save action.
- Added placeholder-only writing prompts, Ctrl/Cmd+Enter save, disabled editing during submission, visible errors, and shared dialog focus containment/return. The existing 500-character API limit and model configuration check are preserved.
- Redesigned Daily Summary as a 980px daily journal: blue cover, sticky month labels, dated reading cards, expanded prose, and explicit empty/error/retry states. Existing cursor pagination, missing-day generation, regeneration, and glossary candidate actions remain connected to their stores.
- Public demo receives matching sample summaries, full articles, pagination and generation fixtures. These fixtures stay only in the separate public-demo checkout.


## Records, reading detail and archive — 2026-10-17

- Reframed records as a date-anchored stream with a featured first entry, compact continuous entries, and a responsive dark overview area. The writing entry remains tied to today while browsing historical dates.
- Reworked record detail into a full-width reading surface. The selected type and mood stay visible as larger, angled summary marks; the full attribute editor starts collapsed and opens on demand, keeping the reading view compact on tablets. Opening and returning use a temporary source-to-reader shape transition; record data requests remain generation-guarded, and the source receives focus when returning.
- Preserved the independent memory and todo authorization paths. Metadata synchronization no longer overwrites a pending authorization selection; metadata and authorization controls expose their distinct save states.
- Reframed archive items as a responsive 1–3 column file shelf, compacted the upload slot, and connected preview open/close to the source file. Preview remains user-initiated and stale preview requests are discarded.
- Added dirty-draft guards and focus handoff for writing and related dialogs. Reduced-motion mode bypasses large object travel while keeping keyboard open/close available.
- Verification in the isolated `codex/mirror-ui-motion` worktree: production build and browser smoke pass. The smoke uses explicitly mocked local fixtures and checks 375, 768, 1280, 1440, and 1920px widths, record open/return and focus restoration, keyboard activation, filtering, one on-demand preview request, and reduced motion. Upload/confirm, save failure retention, authorization submit outcomes, delete undo, and live-backend behavior remain unverified; see the execution report under `.superpowers/sdd/2026-10-17-0111-feat-mirror-ui-motion/report.md`.
