import assert from 'node:assert/strict'
import test from 'node:test'
import { previewGrowth, previewProduce, previewFarmer } from './scenePreview.ts'

test('preview grows, harvests and replants every bed; produce is capped and collected', () => {
  for (let bed = 0; bed < 16; bed++) {
    const phases = Array.from({length: 72}, (_, seconds) => previewGrowth(seconds, bed))
    assert.ok(phases.some(p => p.focusSeconds === 0 && !p.harvested))
    assert.ok(phases.some(p => p.focusSeconds === 3600 && !p.harvested))
    assert.ok(phases.some(p => p.harvested))
    assert.deepEqual(previewGrowth(72, bed), previewGrowth(0, bed))
    assert.equal(new Set(phases.map(p => p.focusSeconds)).size, 13)
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
