import type { TimerState } from "./timer";

const KEY = "focus-valley-active-timer";
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isTime = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const isTarget = (value: unknown) => isRecord(value) && (
  (value.kind === "crop" && typeof value.cropId === "string" && !!value.cropId) ||
  (value.kind === "animal" && typeof value.animalId === "string" && !!value.animalId)
);
const isIntervals = (value: unknown) => Array.isArray(value) && value.every((interval, index) =>
  isRecord(interval) && isTime(interval.startMs) && isTime(interval.endMs) && (interval.endMs as number) > (interval.startMs as number) &&
  (index === 0 || (interval.startMs as number) >= value[index - 1].endMs)
);

function isTimerState(value: unknown): value is TimerState {
  if (!isRecord(value) || !["running", "paused", "idle"].includes(String(value.status)) || !["focus", "break"].includes(String(value.kind)) ||
    typeof value.label !== "string" || !value.label || typeof value.sessionId !== "string" || !value.sessionId ||
    !isTime(value.focusDurationMs) || !isTime(value.remainingMs) || !isTime(value.deadline) || !isTime(value.runningSinceMs) ||
    !isIntervals(value.runningIntervals) || !Array.isArray(value.completedFocusDurationsMs) || value.completedFocusDurationsMs.length > 4 ||
    !value.completedFocusDurationsMs.every(duration => isTime(duration) && duration >= 15 * 60_000 && duration <= 240 * 60_000) ||
    typeof value.notice !== "string" || typeof value.longBreakFinishedId !== "string" ||
    !(value.target === null || isTarget(value.target))) return false;
  if (value.kind === "focus" && (!isTarget(value.target) || value.lastCompletedFocus !== null)) return false;
  if (value.status === "running" && value.deadline === 0) return false;
  if (value.status === "idle" && (value.kind !== "break" || value.lastCompletedFocus === null)) return false;
  if (value.lastCompletedFocus !== null && (!isRecord(value.lastCompletedFocus) ||
    value.lastCompletedFocus.id !== value.sessionId || typeof value.lastCompletedFocus.label !== "string" ||
    !isTime(value.lastCompletedFocus.durationMs) || !isTarget(value.lastCompletedFocus.target) ||
    !isIntervals(value.lastCompletedFocus.intervals))) return false;
  return true;
}

export function loadTimerState(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isTimerState(value) ? value : null;
  } catch { return null; }
}

export function saveTimerState(timer: TimerState): boolean {
  try {
    if (timer.status === "idle" && !timer.lastCompletedFocus) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(timer));
    return true;
  } catch { return false; }
}

export function clearTimerState() {
  try { localStorage.removeItem(KEY); }
  catch { /* Storage can be unavailable in private browsing. */ }
}
