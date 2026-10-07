import assert from 'node:assert/strict'
import test from 'node:test'
import { advancePath, farmPaths, pathRoute, pathStep } from './farmPaths.ts'
import { frameAreas, areaOrigin, penOrigin } from './sceneLayout.ts'
import { bedState, createFarm } from './farm.ts'

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
    if (!frame.sidePens) {
      const pen = penOrigin(1, 4, frame)
      assert.ok(pathRoute({x:192,y:192},{x:pen.x+192,y:pen.y+320},paths).length > 0)
    }
    if (frame.sidePens) {
      const second = penOrigin(1, 4, frame)
      const destination = {x:second.x+96,y:second.y+192}
      assert.deepEqual(pathRoute({x:192,y:192},destination,farmPaths(3,frame,["chicken","rabbit"])).at(-1),destination)
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
  farm.farmDay.tiles.push({areaId:0,tileId:0,cropId:'peas',focusSeconds:900,harvested:true})
  farm.progress.nextBedIndex = 1
  assert.equal(bedState(farm, 0, 0), 'completed')
  assert.equal(bedState(farm, 0, 1), 'active')
})
