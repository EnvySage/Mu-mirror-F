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

`public/art/water-surface.webp` was generated with built-in imagegen, then encoded as WebP. Prompt: an original 16:9 background looking up from underwater, crisp cel-shaded white/cyan surface ripples, cobalt to midnight blue depth, sparse mirror fragments, quiet lower space for live content, no people, text, logos, or UI.

Barlow Condensed fonts are locally served, sourced through Google Fonts, under the SIL Open Font License in `public/art/fonts/OFL.txt`.

## Checkpoints

1. Shared theme, navigation, fonts, and visual assets.
2. Mirror stage, recent progress, statistics, and snapshot history.
3. Records and calendar.
4. Dialogue, archive, settings, authentication, and interaction polish.

Build with `npm run build`. Local verification artifacts and fixture servers belong in ignored `.verify/`; production API behavior must not depend on fixtures.
