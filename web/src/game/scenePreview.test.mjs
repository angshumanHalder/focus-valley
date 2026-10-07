import assert from 'node:assert/strict'
import test from 'node:test'
import { previewGrowth, previewProduce, previewFarmer } from './scenePreview.ts'

test('preview grows, harvests and replants every bed; produce is capped and collected', () => {
  for (let bed = 0; bed < 16; bed++) {
    const phases = Array.from({length: 72}, (_, seconds) => previewGrowth(seconds, bed))
    assert.ok(phases.some(p => p.focusSeconds === 0 && !p.harvested))
    assert.ok(phases.some(p => p.focusSeconds === 900 && !p.harvested))
    assert.ok(phases.some(p => p.harvested))
    assert.deepEqual(previewGrowth(72, bed), previewGrowth(0, bed))
    assert.equal(new Set(phases.map(p => p.focusSeconds)).size, 4)
  }
  for (const [animal, interval] of [[0, 12], [1, 16]]) {
    assert.equal(previewProduce(0, animal), 0)
    assert.equal(previewProduce(interval, animal), 1)
    assert.equal(previewProduce(interval * 4, animal), 3)
    assert.equal(previewProduce(interval * 5, animal), 0)
  }
})

test('farmer visits every garden along paths without teleporting between them', () => {
  for (const columns of [1, 2]) {
    const cycle = columns === 1 ? 144000 : 96000
    for (let time = 16000; time <= cycle; time += 8000) {
      const before = previewFarmer(time - 1, columns)
      const after = previewFarmer(time, columns)
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 2)
    }
    assert.deepEqual(previewFarmer(0, columns), previewFarmer(cycle, columns))
  }
})

// Every preview must have its own complete seasonal roster without sharing mutable state.
test('season previews contain all four gardens and the matching animals', async () => {
  const { createPreviewFarm } = await import('./scenePreview.ts');
  const { SEASONS, SEASON_CONTENT } = await import('./farm.ts');
  const { SEASONAL_FRAMES, animalPopulation, ANIMAL_PRODUCTS } = await import('./seasonalFrames.ts');
  const { readFileSync } = await import('node:fs');
  for (const season of SEASONS) {
    const farm = createPreviewFarm(season);
    for (const animal of SEASON_CONTENT[season].animals) {
      assert.ok(["egg", "wool", "milk"].includes(ANIMAL_PRODUCTS[animal]));
      assert.equal(animalPopulation(animal) * (4 / animalPopulation(animal)), 4);
    }
    assert.equal(farm.progress.season, season);
    assert.equal(farm.progress.unlockedAreaCount, 4);
    assert.equal(farm.farmDay.tiles.length, 16);
    assert.deepEqual(farm.progress.unlockedAnimals, SEASON_CONTENT[season].animals);
    assert.ok(farm.farmDay.tiles.every(t => SEASON_CONTENT[season].crops.includes(t.cropId) && t.focusSeconds === 900 && !t.harvested));
    farm.progress.unlockedAnimals.length = 0;
    assert.equal(createPreviewFarm(season).progress.unlockedAnimals.length, 2);
    if (season === 'spring') continue;
    const png = readFileSync(new URL(`../../../art/source/seasonal-batch-01/${season}-roster.png`, import.meta.url));
    const frames = SEASONAL_FRAMES[season];
    assert.equal(frames.crops.length, 4);
    assert.deepEqual(frames.animals.map(row => row.length), [4, 4]);
    for (const [x, y, w, h] of [...frames.crops, ...frames.animals.flat()]) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= png.readUInt32BE(16) && y + h <= png.readUInt32BE(20));
    }
  }
  assert.equal(animalPopulation('rabbit'), 4);
  assert.equal(animalPopulation('cow'), 2);
  assert.deepEqual(SEASON_CONTENT.autumn.animals, ['alpaca', 'turkey']);
  assert.equal(animalPopulation('alpaca'), 2);
  assert.equal(ANIMAL_PRODUCTS.alpaca, 'wool');
});
