import assert from 'node:assert/strict'
import test from 'node:test'
import { farmerPosition } from './farmWalk.ts'

test('farmer walks from the central crossing to each current bed and back', () => {
  for (const [tileId, expectedY, expectedX] of [[0, 160, 176], [1, 160, 208], [2, 224, 176], [3, 224, 208]]) {
    assert.deepEqual(farmerPosition(0, 0, tileId, 2), { x: 192, y: 192, facing: expectedY < 192 ? 'up' : 'down', walking: true })
    assert.equal(farmerPosition(1350, 0, tileId, 2).facing, expectedX < 192 ? 'left' : 'right')
    assert.equal(farmerPosition(1500, 0, tileId, 2).x, expectedX)
    assert.equal(farmerPosition(1500, 0, tileId, 2).y, expectedY)
    assert.equal(farmerPosition(2050, 0, tileId, 2).facing, expectedX < 192 ? 'right' : 'left')
    assert.equal(farmerPosition(2500, 0, tileId, 2).facing, expectedY < 192 ? 'down' : 'up')
    assert.deepEqual(farmerPosition(3900, 0, tileId, 2), { x: 192, y: 192, facing: 'down', walking: false })
  }
  assert.equal(farmerPosition(1500, 1, 3, 2).x, 624)
  assert.deepEqual(farmerPosition(0, 1, 3, 1), { x: 192, y: 608, facing: 'down', walking: true })
})
