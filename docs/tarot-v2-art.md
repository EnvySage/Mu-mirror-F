# Tarot v2 native artwork

Generated with the native `image_gen` tool, one distinct prompt per card. Source images are preserved in the native generation folder; selected PNGs are copied to `public/art/tarot/v2`.

The approved reference is `v1/02-priestess.png` plus the five existing v2 samples. New cards retain black silhouettes, angular faceted pigment planes and paper grain. New Wands emphasize amber and yellow; Pentacles emphasize emerald and copper; Cups use teal and silver; Swords use ice blue and silver. Majors vary by symbolism.

The complete generation record lives in `docs/tarot-v2-art-manifest.json`: all 62 new jobs are saved. Together with five approved v2 samples and eleven retained v1 cards, the runtime catalog contains 78 distinct illustrations. `docs/tarot-v2-assets.json` is the authoritative catalog-to-file inventory, including file sizes and SHA-256 hashes, verified on 2026-11-04.

Initial new delivered card: `05-hierophant.png`, visually inspected, 1024 x 1536.

## Major and Wands delivery

The major/Wands agent delivered all 23 assigned new cards: 10 missing majors (`05`, `11`-`16`, `18`, `20`, `21`) and all 13 non-Ace Wands (`02`-`10`, `page`, `knight`, `queen`, `king`). All 23 files were decoded and measured at 1024 x 1536. Representative visual checks covered The Hierophant, The Hanged Man, Three of Wands and Queen of Wands.

Three of Wands received one native image edit to remove an extra staff; the selected final visibly has exactly three staffs. The original native output is preserved in the generation folder and its path and correction prompt are recorded in the manifest. The Hanged Man was rendered as a serene magical inversion beneath a tree after the first output was refused by image moderation.

## Swords delivery and final validation

Swords returned to this agent's ownership. All 13 non-Ace Swords (`02`-`10`, `page`, `knight`, `queen`, `king`) are saved, bringing this agent's assigned delivery to 36 new cards: 10 majors, 13 Wands and 13 Swords.

On 2026-11-04, all 36 assigned PNG files were decoded and rechecked at 1024 x 1536; every recorded native source file also exists. All 13 Swords were visually reviewed for readable English title, correct rank label, intact frame and the number of swords in the main scene, excluding border ornaments. Three of Swords has exactly three main swords, and Ten of Swords has exactly ten.

Eight of Swords initially had only seven main swords. One native image edit added the missing sword; the selected final now visibly has four swords on each side, eight total. Only `swords-08.png` changed during this validation. Its original source, selected revision source and exact correction prompt are recorded in `tarot-v2-art-manifest.json`. Final SHA-256: `0394817F84F948E87981DF9DCC641DD51214CE0131F4467813949E24DD1B1759`.

Cups and Pentacles were completed and visually checked by the secondary agent. Their actual prompts, selected source files and correction records are now included in the consolidated primary manifest, with the original records also retained in `tarot-v2-art-secondary-manifest.json`. All generation jobs are complete. The selected Eight of Swords correction is included in both final frontend builds.
