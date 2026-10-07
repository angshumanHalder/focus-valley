import assert from 'node:assert/strict'
import test from 'node:test'
import { areaOrigin, frameAreas, penOrigin, AREA_SIZE } from './sceneLayout.ts'

test('desktop fits every garden and pen; mobile keeps whole areas in a scrollable world', () => {
  for (const [width, height] of [[1440, 900], [2560, 1440], [1200, 600]]) {
    const frame = frameAreas(width, 4, width, 2, height)
    assert.equal(frame.height, height)
    assert.equal(frame.columns, 2)
    assert.equal(frame.sidePens, true)
    const origins = [0, 1, 2, 3].map(i => areaOrigin(i, frame.columns))
    origins.push(penOrigin(0, 4, frame), penOrigin(1, 4, frame))
    assert.equal(new Set(origins.map(({x, y}) => `${x},${y}`)).size, 6)
    for (const {x, y} of origins) {
      assert.ok(frame.inset + x * frame.zoom >= 0)
      assert.ok(frame.inset + (x + AREA_SIZE) * frame.zoom <= width)
      assert.ok(frame.topInset + (y + AREA_SIZE) * frame.zoom <= height)
    }
  }
  const mobile = frameAreas(390, 4, 390, 2, 844)
  assert.equal(mobile.columns, 1)
  assert.equal(mobile.width, 390)
  assert.ok(mobile.height > 844)
  assert.ok(AREA_SIZE * mobile.zoom <= 390)
  assert.deepEqual(penOrigin(0, 4, mobile), areaOrigin(4, 1))
})
