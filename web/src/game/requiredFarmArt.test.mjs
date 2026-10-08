import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarm } from './farm.ts';
import { createPreviewFarm } from './scenePreview.ts';
import { requiredFarmArt } from './requiredFarmArt.ts';

test('farm art includes visible old crops but only unlocked animals from the current season', () => {
  const farm = createFarm(Date.now(), 'UTC');
  assert.deepEqual([...requiredFarmArt(farm).growthSeasons], ['spring']);
  assert.deepEqual(requiredFarmArt(farm).animals, []);
  farm.farmDay.tiles.push({ areaId: 0, tileId: 0, cropId: 'strawberry', focusSeconds: 300, harvested: false });
  farm.progress.season = 'summer';
  farm.progress.unlockedAnimals = ['chicken'];
  assert.deepEqual([...requiredFarmArt(farm).growthSeasons], ['summer', 'spring']);
  assert.deepEqual(requiredFarmArt(farm).animals, []);
  farm.progress.unlockedAnimals.push('goat');
  assert.deepEqual(requiredFarmArt(farm).animals, ['goat']);
});

test('title preview requests spring art and its two visible animals', () => {
  const art = requiredFarmArt(createPreviewFarm('spring'));
  assert.deepEqual([...art.growthSeasons], ['spring']);
  assert.deepEqual(art.animals, ['chicken', 'rabbit']);
});
