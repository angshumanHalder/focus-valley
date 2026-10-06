import assert from 'node:assert/strict'
import test from 'node:test'
import { initialTimer, timerReducer } from './timer.ts'

test('focus, pause, cancellation, and break cycle', () => {
  let state = initialTimer
  state = timerReducer(state, { type: 'startFocus', label: '  Study  ', minutes: 25, now: 0 })
  assert.equal(state.label, 'Study')
  assert.equal(state.deadline, 25 * 60_000)

  state = timerReducer(state, { type: 'pause', now: 10 * 60_000 })
  assert.equal(state.remainingMs, 15 * 60_000)
  state = timerReducer(state, { type: 'tick', now: 40 * 60_000 })
  assert.equal(state.status, 'paused')
  state = timerReducer(state, { type: 'resume', now: 40 * 60_000 })
  state = timerReducer(state, { type: 'cancel', now: 41 * 60_000 })
  assert.deepEqual(state.completedFocusDurationsMs, [])

  for (let count = 1; count <= 4; count++) {
    const start = count * 2_000_000
    state = timerReducer(state, { type: 'startFocus', label: 'Study', minutes: 1, now: start })
    state = timerReducer(state, { type: 'tick', now: start + 60_000 })
    assert.equal(state.completedFocusDurationsMs.length, count)
    assert.equal(state.kind, 'break')
    assert.equal(state.status, 'running')
    assert.equal(state.remainingMs, (count === 4 ? 1 : 5) * 60_000)
    if (count === 1) {
      state = timerReducer(state, { type: 'pause', now: start + 120_000 })
      state = timerReducer(state, { type: 'skipBreak', now: start + 180_000 })
    } else if (count === 2) {
      state = timerReducer(state, { type: 'skipBreak', now: start + 120_000 })
    } else {
      state = timerReducer(state, { type: 'tick', now: state.deadline })
    }
    assert.equal(state.status, 'idle')
  }

  state = timerReducer(state, { type: 'startFocus', label: 'Late tab', minutes: 1, now: 10_000_000 })
  state = timerReducer(state, { type: 'tick', now: 10_500_000 })
  assert.equal(state.status, 'idle')
  assert.deepEqual(state.completedFocusDurationsMs, [60_000, 60_000, 60_000, 60_000, 60_000])
})

test('fourth break uses the last four completed focus durations, capped at 15 minutes', () => {
  let state = initialTimer
  for (const [index, minutes] of [1, 1, 1, 2].entries()) {
    const start = index * 2_000_000
    state = timerReducer(state, { type: 'startFocus', label: 'Work', minutes, now: start })
    state = timerReducer(state, { type: 'tick', now: start + minutes * 60_000 })
    if (index < 3) state = timerReducer(state, { type: 'skipBreak', now: state.deadline - 1 })
  }
  assert.deepEqual(state.completedFocusDurationsMs, [60_000, 60_000, 60_000, 120_000])
  assert.equal(state.remainingMs, 75_000)

  state = timerReducer(state, { type: 'skipBreak', now: state.deadline - 1 })
  for (let index = 0; index < 4; index++) {
    const start = 10_000_000 + index * 2_000_000
    state = timerReducer(state, { type: 'startFocus', label: 'Work', minutes: 25, now: start })
    state = timerReducer(state, { type: 'tick', now: start + 25 * 60_000 })
    if (index < 3) state = timerReducer(state, { type: 'skipBreak', now: state.deadline - 1 })
  }
  assert.equal(state.remainingMs, 15 * 60_000)
})

test('paused wall time is excluded from a completed focus duration', () => {
  let state = timerReducer(initialTimer, { type: 'startFocus', label: 'Work', minutes: 2, now: 0 })
  state = timerReducer(state, { type: 'pause', now: 30_000 })
  state = timerReducer(state, { type: 'resume', now: 600_000 })
  state = timerReducer(state, { type: 'tick', now: 690_000 })
  assert.deepEqual(state.completedFocusDurationsMs, [120_000])
})
