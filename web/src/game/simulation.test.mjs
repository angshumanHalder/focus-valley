import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTimer, timerReducer } from '../reducers/timer.ts';
import { createFarm, completeFocus, previewFocus, activeBed, growthStage, SEASONS, SEASON_CONTENT } from './farm.ts';
import { cropSprite } from './cropGrowthFrames.ts';

const start = Date.parse('2026-04-01T10:00:00Z');
const crop = cropId => ({ kind: 'crop', cropId });

test('all seasonal crops use approved frames at exact stage boundaries; cancellation discards previews', () => {
  for (const season of SEASONS) for (const cropId of SEASON_CONTENT[season].crops) {
    const farm = createFarm(start, 'UTC');
    farm.progress.season = season;
    const before = structuredClone(farm);
    let timer = timerReducer(initialTimer, { type: 'startFocus', now: start, minutes: 25, label: 'Stages', target: crop(cropId) });
    for (const [seconds, stage] of [[0,0], [299,0], [300,1], [599,1], [600,2], [899,2], [900,3]]) {
      const preview = previewFocus(farm, timer.target, [{ startMs: start, endMs: start + seconds * 1000 }]);
      const tile = preview.farmDay.tiles[0];
      assert.equal(growthStage(tile), stage);
      const sprite = cropSprite(tile.cropId, stage, true);
      assert.equal(sprite.texture, `growth-${season}`);
      assert.equal(sprite.frame, `${cropId}-${stage}`);
      if (seconds === 900) {
        assert.deepEqual(activeBed(preview), { areaId: 0, tileId: 1 });
        assert.equal(preview.farmDay.tiles.length, 1);
      }
      assert.deepEqual(preview.inventory, {});
      assert.deepEqual(farm, before);
    }
    timer = timerReducer(timer, { type: 'cancel', now: start + 16 * 60000 });
    assert.equal(timer.lastCompletedFocus, null);
    assert.equal(previewFocus(farm, timer.target, timer.runningIntervals), farm);
    assert.deepEqual(farm, before);
  }
});

test('completed timers discard crop overflow and credit cumulative bonus once', () => {
  let farm = createFarm(start, 'UTC');
  let timer = timerReducer(initialTimer, { type: 'startFocus', id: 'overflow', now: start, minutes: 25, label: 'Overflow', target: crop('strawberry') });
  timer = timerReducer(timer, { type: 'tick', now: start + 25 * 60000 });
  farm = completeFocus(farm, timer.lastCompletedFocus);
  assert.equal(farm.inventory['crop:strawberry'], 4);
  assert.equal('cropCreditSeconds' in farm, false);
  assert.equal(farm.farmDay.tiles.length, 1);
  assert.equal(completeFocus(farm, timer.lastCompletedFocus), farm);
  timer = timerReducer(timer, { type: 'skipBreak', now: start + 25 * 60000 });
  timer = timerReducer(timer, { type: 'startFocus', id: 'next', now: start + 25 * 60000, minutes: 15, label: 'Next crop', target: crop('peas') });
  timer = timerReducer(timer, { type: 'tick', now: start + 40 * 60000 });
  farm = completeFocus(farm, timer.lastCompletedFocus);
  assert.equal(farm.inventory['crop:strawberry'], 4);
  assert.equal(farm.inventory['crop:peas'], 4);
  assert.equal('cropCreditSeconds' in farm, false);

  const fresh = createFarm(start, 'UTC');
  timer = timerReducer(initialTimer, { type: 'startFocus', id: 'bonus', now: start, minutes: 50, label: 'Bonus', target: crop('strawberry') });
  timer = timerReducer(timer, { type: 'tick', now: start + 50 * 60000 });
  const bonus = completeFocus(fresh, timer.lastCompletedFocus);
  assert.equal(bonus.inventory['crop:strawberry'], 4);
  assert.equal('cropCreditSeconds' in bonus, false);
  assert.equal(bonus.bonusBankSeconds, 120);
  assert.equal(bonus.progress.unlockedAreaCount, 1);
  assert.equal(bonus.progress.unlockedAnimals.length, 0);
  assert.equal(bonus.sessions[0].bonusSeconds, 120);
});

test('advancing the clock during a pause adds no growth, and cancelling preserves prior progress', () => {
  const farm = createFarm(start, 'UTC');
  let timer = timerReducer(initialTimer, { type: 'startFocus', id: 'pause', now: start, minutes: 15, label: 'Pause', target: crop('strawberry') });
  timer = timerReducer(timer, { type: 'pause', now: start + 5 * 60000 });
  timer = timerReducer(timer, { type: 'tick', now: start + 65 * 60000 });
  const preview = previewFocus(farm, timer.target, timer.runningIntervals);
  assert.equal(preview.farmDay.tiles[0].focusSeconds, 300);
  timer = timerReducer(timer, { type: 'resume', now: start + 65 * 60000 });
  timer = timerReducer(timer, { type: 'tick', now: start + 75 * 60000 });
  const completed = completeFocus(farm, timer.lastCompletedFocus);
  assert.equal(completed.sessions[0].focusSeconds, 900);
  assert.equal(completed.inventory['crop:strawberry'], 4);
  timer = timerReducer(timer, { type: 'skipBreak', now: start + 75 * 60000 });
  timer = timerReducer(timer, { type: 'startFocus', id: 'cancel', now: start + 75 * 60000, minutes: 25, label: 'Cancel', target: crop('peas') });
  timer = timerReducer(timer, { type: 'cancel', now: start + 85 * 60000 });
  assert.equal(previewFocus(completed, timer.target, timer.runningIntervals), completed);
  assert.equal(completed.inventory['crop:strawberry'], 4);
});

test('approved offsets stay consistent and carried crops retain their own seasonal artwork', () => {
  assert.equal(cropSprite('pumpkin', 0, true).offsetY, -8);
  assert.equal(cropSprite('rice', 0, true).offsetY, -10);
  for (const name of ['rice', 'okra', 'pumpkin', 'carrot', 'cabbage', 'cauliflower']) assert.equal(cropSprite(name, 1, true).offsetY, -5);
  for (const name of ['strawberry', 'peas', 'corn']) assert.equal(cropSprite(name, 1, true).offsetX, -2);
  assert.equal(cropSprite('radish', 1, true).offsetX, -1);
  assert.equal(cropSprite('corn', 1, false).offsetX, 0);
  assert.equal(cropSprite('strawberry', 2, true).texture, 'growth-spring');
  for (const season of SEASONS) for (const name of SEASON_CONTENT[season].crops) for (const stage of [2,3]) {
    assert.equal(cropSprite(name, stage, true).offsetX, 0);
    assert.equal(cropSprite(name, stage, true).offsetY, 0);
  }
});
