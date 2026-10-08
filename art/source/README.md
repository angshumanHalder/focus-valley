# Art source

Source art is grouped by asset type. Seasonal assets use the same filenames inside each season folder.

```text
animals/spring/       Spring animal pose and production sheets
characters/farmer/    Farmer movement and appearance sheets
crops/<season>/       Seasonal crop growth sheets
environment/ground/   Ground and path textures
environment/props/    Farm props
seasons/<season>/     Seasonal crop and animal roster sheets
prompts.json          Generation prompts and source-sheet metadata
transparency-preview.html
```

Runtime crop frames use `web/src/game/cropGrowthFrames.ts`; animal poses use `web/src/game/seasonalFrames.ts`. The PNGs remain editable source art. Some review sheets are not shipped in the web build. Trees are out of game scope.

Generated seasonal source sheets and review status are documented in `prompts.json`. Open `transparency-preview.html` to inspect roster transparency over light, dark, and grass backgrounds.
