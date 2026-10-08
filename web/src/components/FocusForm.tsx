import { SubmitEvent, useEffect, useReducer, useRef, useState } from "react";
import { restoreBreakCycle, timerReducer, type CompletedFocus, type TimerState } from "../reducers/timer";
import { saveTimerState } from "../reducers/timerSave";
import { playTimerSound } from "../utils/timerSound";

type FocusFormProps = {
  target: FocusTarget | null;
  onFocusComplete: (focus: CompletedFocus) => void;
  onFocusStart: (target: FocusTarget) => void;
  onFocusActiveChange: (active: boolean) => void;
  onFocusRunningChange: (running: boolean) => void;
  onFocusPreview: (intervals: RunningInterval[]) => void;
  plantedSeconds: number;
  cycleDurationsMs: number[];
  longBreakPending: boolean;
  lastSessionId: string;
  onLongBreakFinished: () => void;
  restoredTimer?: TimerState | null;
};

export const FocusForm = ({ target, onFocusComplete, onFocusStart, onFocusActiveChange, onFocusRunningChange, onFocusPreview, plantedSeconds, cycleDurationsMs, longBreakPending, lastSessionId, onLongBreakFinished, restoredTimer }: FocusFormProps) => {
  const [timer, dispatch] = useReducer(timerReducer, null, () => restoredTimer
    ? timerReducer(restoredTimer, { type: "tick", now: Date.now() })
    : restoreBreakCycle(cycleDurationsMs, longBreakPending, lastSessionId, Date.now()));
  const [timerSaveFailed, setTimerSaveFailed] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try { return window.localStorage.getItem("focus-valley-sound") !== "off"; }
    catch { return true; }
  });
  const handledCompletion = useRef("");
  const handledLongBreak = useRef("");
  const handledStart = useRef("");
  const [now, setNow] = useState(Date.now);
  const [duration, setDuration] = useState("25");
  const [customMinutes, setCustomMinutes] = useState("30");
  const [label, setLabel] = useState("");

  function prepareAudio() {
    if (!window.AudioContext) return null;
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      void context.resume().catch(() => {});
      return context;
    } catch { return null; }
  }

  useEffect(() => () => { void audioContext.current?.close().catch(() => {}); }, []);

  useEffect(() => {
    const saved = saveTimerState(timer);
    setTimerSaveFailed(timer.status !== "idle" && !saved);
  }, [timer]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try { window.localStorage.setItem("focus-valley-sound", next ? "on" : "off"); }
    catch { /* The preference remains active for this tab. */ }
    if (next) prepareAudio();
  }

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      dispatch({ type: "tick", now: time });
    }, 250);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  useEffect(() => {
    if (timer.lastCompletedFocus && handledCompletion.current !== timer.lastCompletedFocus.id) {
      handledCompletion.current = timer.lastCompletedFocus.id;
      if (soundOn && audioContext.current?.state === "running") {
        try { playTimerSound(audioContext.current, "end"); }
        catch { /* Audio failure must not block a completed task. */ }
      }
      onFocusComplete(timer.lastCompletedFocus);
    }
  }, [timer.lastCompletedFocus, onFocusComplete, soundOn]);

  useEffect(() => {
    if (timer.longBreakFinishedId && handledLongBreak.current !== timer.longBreakFinishedId) {
      handledLongBreak.current = timer.longBreakFinishedId;
      onLongBreakFinished();
    }
  }, [timer.longBreakFinishedId, onLongBreakFinished]);

  useEffect(() => {
    onFocusActiveChange(timer.kind === "focus" && timer.status !== "idle");
  }, [timer.kind, timer.status, onFocusActiveChange]);

  useEffect(() => {
    onFocusRunningChange(timer.kind === "focus" && timer.status === "running");
  }, [timer.kind, timer.status, onFocusRunningChange]);

  useEffect(() => {
    if (timer.kind === "focus" && timer.status !== "idle" && timer.target && handledStart.current !== timer.sessionId) {
      handledStart.current = timer.sessionId;
      onFocusStart(timer.target);
    }
  }, [timer.kind, timer.status, timer.target, timer.sessionId, onFocusStart]);

  const startFocus = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minutes = Number(duration === "custom" ? customMinutes : duration);
    const time = Date.now();
    setNow(time);
    if (!target) return;
    if (soundOn) {
      const context = prepareAudio();
      if (context) {
        try { playTimerSound(context, "start"); }
        catch { /* Audio failure must not block the timer. */ }
      }
    }
    dispatch({ type: "startFocus", label, minutes, now: time, target });
  };

  const remainingMs =
    timer.status === "running"
      ? Math.max(0, timer.deadline - now)
      : timer.status === "paused"
        ? timer.remainingMs
        : 0;

  const visualStage = Math.floor((plantedSeconds * 1000 + timer.focusDurationMs - remainingMs) / 300_000);
  // Send a visual snapshot only when a growth stage or timer status changes.
  useEffect(() => {
    onFocusPreview(timer.kind !== "focus" || timer.status === "idle" ? [] : [
      ...timer.runningIntervals,
      ...(timer.status === "running" ? [{ startMs: timer.runningSinceMs, endMs: Math.min(now, timer.deadline) }] : []),
    ]);
  }, [visualStage, timer.kind, timer.status, timer.runningIntervals, timer.runningSinceMs, timer.deadline, onFocusPreview]);

  const seconds = Math.ceil(remainingMs / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const act = (
    type: "pause" | "resume" | "cancel" | "skipBreak",
  ) => {
    const time = Date.now();
    setNow(time);
    dispatch({ type, now: time });
  };

  return (
    <>
      <h2 id="timer-heading">Focus timer</h2>
      <button type="button" className="sound-toggle" aria-pressed={soundOn} onClick={toggleSound}>Sound: {soundOn ? "on" : "off"}</button>
      {timer.status === "idle" ? (
        <form onSubmit={startFocus}>
          <label htmlFor="focus-label">What are you working on?</label>
          <input
            id="focus-label"
            name="label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Write the first draft"
          />

          <fieldset>
            <legend>Focus length</legend>
            <div className="choices">
              <label>
                <input
                  type="radio"
                  name="duration"
                  value="15"
                  checked={duration === "15"}
                  onChange={() => setDuration("15")}
                />{" "}
                15 min
              </label>
              <label>
                <input
                  type="radio"
                  name="duration"
                  value="25"
                  checked={duration === "25"}
                  onChange={() => setDuration("25")}
                />{" "}
                25 min
              </label>
              <label>
                <input
                  type="radio"
                  name="duration"
                  value="50"
                  checked={duration === "50"}
                  onChange={() => setDuration("50")}
                />{" "}
                50 min
              </label>
              <label>
                <input
                  type="radio"
                  name="duration"
                  value="custom"
                  checked={duration === "custom"}
                  onChange={() => setDuration("custom")}
                />{" "}
                Custom
              </label>
            </div>
          </fieldset>

          {duration === "custom" && (
            <div className="custom-length">
              <label htmlFor="custom-minutes">Minutes</label>
              <input
                id="custom-minutes"
                type="number"
                min="15"
                max="240"
                required
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
              />
            </div>
          )}
          <button type="submit" className="primary" disabled={!target}>
            Start focus
          </button>
        </form>
      ) : (
        <div className="active-timer">
          <p>{timer.kind === "focus" ? timer.label : "Rest your mind"}</p>
          <p
            className="clock"
            role="timer"
            aria-label={`${timer.kind === "focus" ? "Focus" : "Break"} time remaining: ${clock}`}
          >
            {clock}
          </p>
          <p>
            {timer.status === "paused"
              ? "Paused"
              : timer.kind === "focus"
                ? "Focus time"
                : "Break time"}
          </p>
          <div className="actions">
            {timer.status === "running" ? (
              <button type="button" onClick={() => act("pause")}>
                Pause
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => act("resume")}
              >
                Resume
              </button>
            )}
            {timer.kind === "break" ? (
              <button type="button" onClick={() => act("skipBreak")}>
                Skip break
              </button>
            ) : (
              <button type="button" onClick={() => act("cancel")}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <p className="notice" role="status">
        {timer.notice}
      </p>
      {timerSaveFailed && <p role="alert">Timer recovery is unavailable in this browser. Keep this tab open until focus ends.</p>}
      <p className="session-count">Sessions toward long break: {timer.completedFocusDurationsMs.length} / 4</p>
    </>
  );
};
