import assert from 'node:assert/strict'
import test from 'node:test'
import { advancePath, farmPaths, pathRoute, pathStep } from './farmPaths.ts'
import { frameAreas, areaOrigin, penOrigin } from './sceneLayout.ts'
import { bedState, createFarm, previewFocus } from './farm.ts'

test('routes stay on unlocked paths on desktop and mobile, including bed approaches', () => {
  for (const width of [390, 1600]) {
    const frame = frameAreas(width, 4, width, 2, 900)
    const locked = farmPaths(1, frame, [])
    assert.equal(pathStep({x: 336, y: 192}, 'right', locked), undefined)
    assert.equal(pathStep({x: 192, y: 48}, 'up', locked), undefined)
    const paths = farmPaths(4, frame, ['chicken', 'rabbit'])
    for (let area = 0; area < 4; area++) {
      const origin = areaOrigin(area, frame.columns)
      const target = {x: origin.x + 176, y: origin.y + 160}
      const route = pathRoute({x:192,y:192}, target, paths)
      assert.deepEqual(route.at(-1), target)
      for (let i = 1; i < route.length; i++) assert.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].y-route[i-1].y),16)
      assert.deepEqual(advancePath({x:192,y:192}, route, 10000).x, target.x)
      assert.equal(route.length, 0)
    }
    if (frame.sidePens) {
      const pen = penOrigin(0, 4, frame)
      assert.ok(paths.has(`${pen.x+96},${pen.y+192}`))
      assert.equal(farmPaths(4, frame, []).has(`${pen.x+96},${pen.y+192}`), false)
    }
  }
})

test('current bed is available, future beds are locked, harvested beds stay completed', () => {
  const farm = createFarm(Date.now(), 'UTC')
  assert.equal(bedState(farm, 0, 0), 'active')
  assert.equal(bedState(farm, 0, 1), 'locked')
  assert.equal(bedState(farm, 1, 0), 'locked')
  farm.farmDay.tiles.push({areaId:0,tileId:0,cropId:'peas',focusSeconds:3600,harvested:true})
  assert.equal(bedState(farm, 0, 0), 'completed')
  assert.equal(bedState(farm, 0, 1), 'active')
})

test('live growth is provisional, excludes paused gaps, and banks no next-day time', () => {
  const start = Date.parse('2026-10-07T23:50:00Z')
  const farm = createFarm(start, 'UTC')
  farm.farmDay.tiles.push({areaId:0,tileId:0,cropId:'peas',focusSeconds:3000,harvested:false})
  const intervals = [{startMs:start,endMs:start+300000}, {startMs:start+420000,endMs:start+1200000}]
  const preview = previewFocus(farm, {areaId:0,tileId:0}, intervals)
  assert.equal(preview.farmDay.tiles[0].focusSeconds, 3480)
  assert.equal(farm.farmDay.tiles[0].focusSeconds, 3000)
  assert.deepEqual(preview.progress, farm.progress)
  assert.equal(preview.farmDay.completedSessions, 0)
  assert.equal(preview.farmDay.focusCreditSeconds, 0)
  assert.equal(previewFocus(farm, {areaId:0,tileId:0}, [{startMs:start-3600000,endMs:start}]).farmDay.tiles[0].harvested, false)
  assert.equal(previewFocus(farm, null, intervals), farm)
})
