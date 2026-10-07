# Seasonal source art — batch 01

Generated with the built-in image_gen tool on 2026-10-07. Exact prompts and source filenames are in prompts.json. Tree assets have been removed from product scope. Seasonal roster sheets were edited with imagegen to remove their tree rows.

## Contents

- Four seasonal roster sheets: summer, rainy, autumn, winter. Each contains four mature crops, four poses for each of two animals, with the former tree rows removed.
- Five growth source sheets: one per season, covering all twenty crop species.
- Farmer options: three choices each for hair, skin, shirt, and pants; standing references, not separated animation layers.
- Spring production: eggs, nests, wool, chicken nesting poses, and rabbit grooming poses.

## Review and integration status

These are generated source sheets, not validated runtime atlases. Correction: the image preview displayed colored RGB backdrop data, but PNG alpha inspection found those sampled backdrop pixels fully transparent in the original summer, autumn, and winter sheets. Background removal is not established as necessary. Open transparency-preview.html in a browser to inspect actual compositing over light, dark, and grass backgrounds; fine-edge halo acceptance remains pending. A summer regeneration was discarded because it did not establish an improvement.

Growth sheets do not reliably follow the requested thirteen-column layout. Select and align exactly one planted frame plus twelve growth stages per crop; fix overlapping sprites and inconsistent maturity ordering before slicing. Do not use equal-width automatic slicing on these sheets.

Animal poses are source poses, not complete four-direction walk cycles. Farmer customization still needs separate, aligned layers and walking frames. Spring production rabbits need comparison against the existing approved rabbit before replacement.

Other seasons' product identities are not yet agreed, so their product icons are not included. Full-farm seasonal composition review and game integration remain pending.

Autumn now features alpacas and turkeys. The alpaca replacement enlarged the animal rows; runtime frame coordinates have been updated accordingly.
