import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignFocusCredit, chooseTree, completeFocus, createFarm, growthStage,
  openFarmDay, plantCrop, SEASON_CONTENT,
} from './farm.ts'
import { initialTimer, timerReducer } from '../reducers/timer.ts'

const at = value => Date.parse(value)

test('crop visuals advance every five minutes through harvest', () => {
  const tile = { areaId: 0, tileId: 0, cropId: 'peas', harvested: false }
  for (const [seconds, stage] of [[0, 0], [299, 0], [300, 1], [599, 1], [600, 2], [3599, 11], [3600, 12]]) {
    assert.equal(growthStage({ ...tile, focusSeconds: seconds }), stage)
  }
})

test('four tiles unlock each area, harvests unlock animals, and trees need completed areas', () => {
  let farm = createFarm(at('2026-04-01T00:00:00Z'), 'UTC')
  assert.equal(farm.progress.unlockedAreaCount, 1)
  assert.throws(() => plantCrop(farm, 1, 0, 'strawberry'))
  assert.throws(() => plantCrop(farm, 0, 0, 'tomato'))
  assert.throws(() => chooseTree(farm, 0, 'apple'))

  for (let areaId = 0; areaId < 4; areaId++) {
    for (let tileId = 0; tileId < 4; tileId++) {
      const startMs = at('2026-04-01T00:00:00Z') + (areaId * 4 + tileId) * 3_600_000
      farm = plantCrop(farm, areaId, tileId, 'strawberry')
      assert.throws(() => plantCrop(farm, areaId, tileId, 'peas'))
      farm = completeFocus(farm, areaId, tileId, [{ startMs, endMs: startMs + 3_600_000 }]).farm
      const tile = farm.farmDay.tiles.find(tile => tile.areaId === areaId && tile.tileId === tileId)
      assert.equal(tile.harvested, true)
      assert.equal(growthStage(tile), 12)
    }
    assert.equal(farm.progress.unlockedAreaCount, Math.min(4, areaId + 2))
    farm = chooseTree(farm, areaId, 'apple')
    assert.equal(farm.progress.trees[areaId], 'apple')
  }
  assert.equal(farm.progress.totalHarvests, 16)
  assert.equal(farm.progress.seasonHarvests, 16)
  assert.deepEqual(farm.progress.unlockedAnimals, ['chicken', 'rabbit'])
  assert.equal(farm.farmDay.completedSessions, 16)
})

test('growth stages, credit leftovers, and crop beds reset on a new farm day', () => {
  let farm = createFarm(at('2026-04-01T00:00:00Z'), 'UTC')
  farm = plantCrop(farm, 0, 0, 'radish')
  let now = at('2026-04-01T00:00:00Z')
  assert.equal(growthStage(farm.farmDay.tiles[0]), 0)
  for (const expectedStage of [1, 2, 3]) {
    farm = completeFocus(farm, 0, 0, [{ startMs: now, endMs: now + 300_000 }]).farm
    now += 300_000
    assert.equal(growthStage(farm.farmDay.tiles[0]), expectedStage)
  }
  const before = farm
  assert.equal(before.progress.activeDaysInSeason, 1)
  const transition = openFarmDay(farm, at('2026-04-02T00:00:00Z'))
  farm = transition.farm
  assert.equal(before.farmDay.tiles[0].focusSeconds, 900)
  assert.equal(transition.closedDays[0].tiles[0].focusSeconds, 900)
  assert.deepEqual(farm.farmDay.tiles, [])
  assert.equal(farm.progress.activeDaysInSeason, 1)
  assert.equal(farm.progress.totalActiveDays, 1)

  farm = plantCrop(farm, 0, 0, 'radish')
  farm = { ...farm, farmDay: { ...farm.farmDay, focusCreditSeconds: 4000 } }
  farm = assignFocusCredit(farm, 0, 0)
  assert.equal(farm.farmDay.tiles[0].focusSeconds, 3600)
  assert.equal(farm.farmDay.focusCreditSeconds, 400)
  assert.equal(farm.progress.totalHarvests, 1)
})

test('active days advance seasons only at reset; inactive days do not', () => {
  let farm = createFarm(at('2026-04-01T00:00:00Z'), 'UTC')
  for (let day = 1; day <= 7; day++) {
    const startMs = at('2026-04-01T00:00:00Z') + (day - 1) * 86_400_000
    farm = plantCrop(farm, 0, 0, 'strawberry')
    farm = completeFocus(farm, 0, 0, [{ startMs, endMs: startMs + 60_000 }]).farm
    assert.equal(farm.progress.season, 'spring')
    assert.equal(farm.progress.activeDaysInSeason, day)
    farm = openFarmDay(farm, startMs + 86_400_000).farm
  }
  assert.equal(farm.progress.season, 'summer')
  assert.equal(farm.progress.activeDaysInSeason, 0)
  assert.equal(farm.progress.totalActiveDays, 7)
  farm = openFarmDay(farm, at('2026-05-01T00:00:00Z')).farm
  assert.equal(farm.progress.season, 'summer')
  assert.equal(farm.progress.totalActiveDays, 7)
  assert.deepEqual(SEASON_CONTENT[farm.progress.season].crops, ['tomato', 'corn', 'pepper', 'sunflower'])
  assert.throws(() => plantCrop(farm, 0, 0, 'strawberry'))
  farm = plantCrop(farm, 0, 0, 'tomato')
  assert.equal(farm.progress.unlockedAreaCount, 1)
})

test('a completed timer crossing local midnight grows the old tile and banks new-day time', () => {
  const startMs = at('2026-10-06T18:20:00Z') // 23:50 in Asia/Kolkata
  let farm = createFarm(startMs, 'Asia/Kolkata')
  farm = plantCrop(farm, 0, 0, 'strawberry')
  const result = completeFocus(farm, 0, 0, [{ startMs, endMs: startMs + 1_200_000 }])
  assert.deepEqual(result.focusSecondsByDate, { '2026-10-06': 600, '2026-10-07': 600 })
  assert.equal(result.closedDays[0].tiles[0].focusSeconds, 600)
  assert.equal(result.closedDays[0].completedSessions, 0)
  assert.equal(result.farm.farmDay.date, '2026-10-07')
  assert.equal(result.farm.farmDay.focusCreditSeconds, 600)
  assert.equal(result.farm.farmDay.completedSessions, 1)
  assert.equal(result.farm.progress.totalActiveDays, 1)
  farm = plantCrop(result.farm, 0, 0, 'peas')
  farm = assignFocusCredit(farm, 0, 0)
  assert.equal(farm.farmDay.tiles[0].focusSeconds, 600)
  assert.equal(farm.farmDay.focusCreditSeconds, 0)
})

test('paused time earns nothing and intervening daily credit expires', () => {
  const startMs = at('2026-10-06T18:25:00Z') // 23:55 in Asia/Kolkata
  let farm = plantCrop(createFarm(startMs, 'Asia/Kolkata'), 0, 0, 'strawberry')
  const result = completeFocus(farm, 0, 0, [
    { startMs, endMs: startMs + 300_000 },
    { startMs: startMs + 600_000, endMs: startMs + 1_200_000 },
  ])
  assert.deepEqual(result.focusSecondsByDate, { '2026-10-06': 300, '2026-10-07': 600 })
  assert.equal(result.farm.farmDay.focusCreditSeconds, 600)
  assert.throws(() => completeFocus(farm, 0, 0, [
    { startMs, endMs: startMs + 300_000 },
    { startMs: startMs + 200_000, endMs: startMs + 500_000 },
  ]))

  const late = completeFocus(farm, 0, 0, [
    { startMs, endMs: startMs + 300_000 },
    { startMs: at('2026-10-06T18:40:00Z'), endMs: at('2026-10-06T18:45:00Z') },
    { startMs: at('2026-10-07T18:40:00Z'), endMs: at('2026-10-07T18:45:00Z') },
  ])
  assert.equal(late.closedDays.length, 2)
  assert.equal(late.closedDays[1].focusCreditSeconds, 300)
  assert.equal(late.farm.farmDay.date, '2026-10-08')
  assert.equal(late.farm.farmDay.focusCreditSeconds, 300)
  assert.equal(late.farm.progress.totalActiveDays, 1)
})

test('winter rolls back to spring after the seventh active day and keeps permanent unlocks', () => {
  let farm = createFarm(at('2026-04-01T00:00:00Z'), 'UTC')
  farm = {
    ...farm,
    progress: {
      ...farm.progress, season: 'winter', activeDaysInSeason: 6,
      totalActiveDays: 34, seasonHarvests: 8, unlockedAnimals: ['chicken'],
      trees: { 0: 'apple' },
    },
  }
  farm = plantCrop(farm, 0, 0, 'wheat')
  const startMs = at('2026-04-01T00:00:00Z')
  farm = completeFocus(farm, 0, 0, [{ startMs, endMs: startMs + 60_000 }]).farm
  assert.equal(farm.progress.season, 'winter')
  assert.equal(farm.progress.activeDaysInSeason, 7)
  farm = openFarmDay(farm, at('2026-04-02T00:00:00Z')).farm
  assert.equal(farm.progress.season, 'spring')
  assert.equal(farm.progress.activeDaysInSeason, 0)
  assert.equal(farm.progress.seasonHarvests, 0)
  assert.equal(farm.progress.totalActiveDays, 35)
  assert.deepEqual(farm.progress.unlockedAnimals, ['chicken'])
  assert.equal(farm.progress.trees[0], 'apple')
})

test('focus past a tile harvest threshold is counted once and growth remains capped', () => {
  const startMs = at('2026-04-01T00:00:00Z')
  const farm = plantCrop(createFarm(startMs, 'UTC'), 0, 0, 'peas')
  const result = completeFocus(farm, 0, 0, [
    { startMs, endMs: startMs + 3_500_000 },
    { startMs: startMs + 3_600_000, endMs: startMs + 3_800_000 },
    { startMs: startMs + 3_900_000, endMs: startMs + 4_200_000 },
  ])
  assert.equal(result.farm.farmDay.tiles[0].focusSeconds, 3600)
  assert.equal(result.farm.progress.totalHarvests, 1)
  assert.equal(result.focusSecondsByDate['2026-04-01'], 4000)
})

test('paused timer intervals credit the correct farm days', () => {
  const startMs = at('2026-10-06T18:25:00Z') // 23:55 in Asia/Kolkata
  const farm = plantCrop(createFarm(startMs, 'Asia/Kolkata'), 0, 0, 'strawberry')
  let timer = timerReducer(initialTimer, {
    type: 'startFocus', label: 'Study', minutes: 10, now: startMs,
    target: { areaId: 0, tileId: 0 },
  })
  timer = timerReducer(timer, { type: 'pause', now: startMs + 120_000 })
  timer = timerReducer(timer, { type: 'resume', now: startMs + 360_000 })
  timer = timerReducer(timer, { type: 'tick', now: startMs + 840_000 })
  const result = completeFocus(farm, 0, 0, timer.lastCompletedFocus.intervals)
  assert.equal(result.closedDays[0].tiles[0].focusSeconds, 120)
  assert.equal(result.farm.farmDay.focusCreditSeconds, 480)
  assert.deepEqual(result.focusSecondsByDate, { '2026-10-06': 120, '2026-10-07': 480 })
})

test('millisecond interval sums still reach the exact harvest threshold', () => {
  const startMs = at('2026-04-01T00:00:00Z')
  const farm = plantCrop(createFarm(startMs, 'UTC'), 0, 0, 'peas')
  let cursor = startMs
  const intervals = [633086, 354736, 101188, 707458, 163518, 9316, 636532, 17240, 382592, 594334]
    .map(duration => {
      const interval = { startMs: cursor, endMs: cursor + duration }
      cursor += duration
      return interval
    })
  const result = completeFocus(farm, 0, 0, intervals)
  assert.equal(result.farm.farmDay.tiles[0].focusSeconds, 3600)
  assert.equal(result.farm.farmDay.tiles[0].harvested, true)
  assert.equal(result.farm.progress.totalHarvests, 1)
})
