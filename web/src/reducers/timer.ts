export type TimerState = {
  status: 'idle' | 'running' | 'paused'
  kind: 'focus' | 'break'
  label: string
  focusDurationMs: number
  remainingMs: number
  deadline: number
  completedFocusDurationsMs: number[]
  runningSinceMs: number
  runningIntervals: { startMs: number; endMs: number }[]
  target: { areaId: number; tileId: number } | null
  lastCompletedFocus: CompletedFocus | null
  notice: string
}

export type CompletedFocus = {
  label: string
  durationMs: number
  intervals: { startMs: number; endMs: number }[]
  target: { areaId: number; tileId: number } | null
}

export type TimerAction =
  | { type: 'startFocus'; label: string; minutes: number; now: number; target?: { areaId: number; tileId: number } }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'cancel'; now: number }
  | { type: 'skipBreak'; now: number }

export const initialTimer: TimerState = {
  status: 'idle',
  kind: 'focus',
  label: '',
  focusDurationMs: 0,
  remainingMs: 25 * 60_000,
  deadline: 0,
  completedFocusDurationsMs: [],
  runningSinceMs: 0,
  runningIntervals: [],
  target: null,
  lastCompletedFocus: null,
  notice: '',
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  if (action.type === 'startFocus' && state.status === 'idle') {
    const label = action.label.trim()
    if (!label || !Number.isInteger(action.minutes) || action.minutes < 1 || action.minutes > 240) return state
    const remainingMs = action.minutes * 60_000
    return { ...state, status: 'running', kind: 'focus', label, focusDurationMs: remainingMs, remainingMs, deadline: action.now + remainingMs, runningSinceMs: action.now, runningIntervals: [], target: action.target ?? null, lastCompletedFocus: null, notice: '' }
  }

  if (action.type === 'skipBreak' && state.kind === 'break' && state.status !== 'idle') {
    if (state.status === 'running' && action.now >= state.deadline) {
      return timerReducer(state, { type: 'tick', now: action.now })
    }
    return { ...state, status: 'idle', remainingMs: 0, deadline: 0, notice: 'Break skipped. Ready to focus.' }
  }

  if (action.type === 'cancel' && state.status !== 'idle') {
    if (state.status === 'running' && action.now >= state.deadline) {
      return timerReducer(state, { type: 'tick', now: action.now })
    }
    return { ...state, status: 'idle', deadline: 0, remainingMs: 0, runningIntervals: [], target: null, notice: state.kind === 'focus' ? 'Focus cancelled. No progress earned.' : 'Break cancelled.' }
  }

  if ((action.type === 'tick' || action.type === 'pause') && state.status === 'running') {
    if (action.now >= state.deadline) {
      if (state.kind === 'break') {
        return { ...state, status: 'idle', remainingMs: 0, deadline: 0, notice: 'Break complete. Ready to focus.' }
      }
      const completedFocusDurationsMs = [...state.completedFocusDurationsMs, state.focusDurationMs]
      const lastCompletedFocus: CompletedFocus = {
        label: state.label,
        durationMs: state.focusDurationMs,
        intervals: [...state.runningIntervals, { startMs: state.runningSinceMs, endMs: state.deadline }],
        target: state.target,
      }
      const breakDurationMs = completedFocusDurationsMs.length % 4 === 0
        ? Math.min(15 * 60_000, completedFocusDurationsMs.slice(-4).reduce((total, duration) => total + duration, 0) / 4)
        : 5 * 60_000
      const deadline = state.deadline + breakDurationMs
      if (action.now >= deadline) {
        return { ...state, status: 'idle', kind: 'break', remainingMs: 0, deadline: 0, completedFocusDurationsMs, runningIntervals: [], lastCompletedFocus, notice: `${state.label} and break complete. Ready to focus.` }
      }
      return { ...state, status: 'running', kind: 'break', remainingMs: deadline - action.now, deadline, completedFocusDurationsMs, runningIntervals: [], lastCompletedFocus, notice: `${state.label} complete. Break started.` }
    }
    if (action.type === 'pause') {
      return { ...state, status: 'paused', remainingMs: state.deadline - action.now, deadline: 0, runningIntervals: state.kind === 'focus' ? [...state.runningIntervals, { startMs: state.runningSinceMs, endMs: action.now }] : state.runningIntervals }
    }
  }

  if (action.type === 'resume' && state.status === 'paused') {
    return { ...state, status: 'running', deadline: action.now + state.remainingMs, runningSinceMs: action.now }
  }

  return state
}
