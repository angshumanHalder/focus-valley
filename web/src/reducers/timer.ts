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
  target: FocusTarget | null
  sessionId: string
  lastCompletedFocus: CompletedFocus | null
  longBreakFinishedId: string
  notice: string
}

export type CompletedFocus = {
  id: string
  label: string
  durationMs: number
  intervals: { startMs: number; endMs: number }[]
  target: FocusTarget | null
}

export type TimerAction =
  | { type: 'startFocus'; label: string; minutes: number; now: number; target?: FocusTarget; id?: string }
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
  sessionId: '',
  lastCompletedFocus: null,
  longBreakFinishedId: '',
  notice: '',
}

export function restoreBreakCycle(durations: number[], pending: boolean, sessionId: string, now: number): TimerState {
  // ponytail: Legacy saves without a timer snapshot restart a pending long break at 15 minutes.
  return pending
    ? { ...initialTimer, status: 'running', kind: 'break', remainingMs: 15 * 60_000, deadline: now + 15 * 60_000, completedFocusDurationsMs: durations, sessionId, notice: 'Long break ready.' }
    : { ...initialTimer, completedFocusDurationsMs: durations }
}

export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  if (action.type === 'startFocus' && state.status === 'idle') {
    const label = action.label.trim()
    if (!label || !Number.isInteger(action.minutes) || action.minutes < 15 || action.minutes > 240) return state
    const remainingMs = action.minutes * 60_000
    return { ...state, status: 'running', kind: 'focus', sessionId: action.id ?? String(action.now), label, focusDurationMs: remainingMs, remainingMs, deadline: action.now + remainingMs, runningSinceMs: action.now, runningIntervals: [], target: action.target ?? null, lastCompletedFocus: null, longBreakFinishedId: '', notice: '' }
  }

  if (action.type === 'skipBreak' && state.kind === 'break' && state.status !== 'idle') {
    if (state.status === 'running' && action.now >= state.deadline) {
      return timerReducer(state, { type: 'tick', now: action.now })
    }
    const longBreak = state.completedFocusDurationsMs.length === 4
    return { ...state, status: 'idle', remainingMs: 0, deadline: 0, completedFocusDurationsMs: longBreak ? [] : state.completedFocusDurationsMs, longBreakFinishedId: longBreak ? state.sessionId : '', notice: 'Break skipped. Ready to focus.' }
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
        const longBreak = state.completedFocusDurationsMs.length === 4
        return { ...state, status: 'idle', remainingMs: 0, deadline: 0, completedFocusDurationsMs: longBreak ? [] : state.completedFocusDurationsMs, longBreakFinishedId: longBreak ? state.sessionId : '', notice: 'Break complete. Ready to focus.' }
      }
      const completedFocusDurationsMs = [...state.completedFocusDurationsMs, state.focusDurationMs]
      const lastCompletedFocus: CompletedFocus = {
        id: state.sessionId,
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
        const longBreak = completedFocusDurationsMs.length === 4
        return { ...state, status: 'idle', kind: 'break', remainingMs: 0, deadline: 0, completedFocusDurationsMs: longBreak ? [] : completedFocusDurationsMs, runningIntervals: [], lastCompletedFocus, longBreakFinishedId: longBreak ? state.sessionId : '', notice: `${state.label} and break complete. Ready to focus.` }
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
