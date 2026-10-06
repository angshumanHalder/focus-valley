import assert from 'node:assert/strict'
import test from 'node:test'
import { areaOrigin, frameAreas } from './sceneLayout.ts'

test('areas stack on mobile and form two rows of two on desktop', () => {
  const mobile = frameAreas(350, 4, 390)
  assert.equal(mobile.columns, 1)
  assert.equal(mobile.rows, 4)
  assert.equal(mobile.width, 350)
  assert.ok(mobile.height > 1400)
  assert.deepEqual(frameAreas(1000, 2, 1440), { columns: 2, rows: 1, zoom: 1, width: 800, height: 384 })
  assert.deepEqual(frameAreas(1000, 4, 1440), { columns: 2, rows: 2, zoom: 1, width: 800, height: 800 })
  assert.deepEqual(frameAreas(1000, 4, 1440, 2), { columns: 2, rows: 3, zoom: 1, width: 800, height: 1216 })
  assert.deepEqual(frameAreas(384, 1, 390, 1), { columns: 1, rows: 2, zoom: 1, width: 384, height: 800 })
  assert.deepEqual(frameAreas(1800, 4, 2100), { columns: 2, rows: 2, zoom: 1, width: 800, height: 800 })
  assert.deepEqual(areaOrigin(3, 2), { x: 416, y: 416 })
  assert.deepEqual(areaOrigin(3, 1), { x: 0, y: 1248 })
})
