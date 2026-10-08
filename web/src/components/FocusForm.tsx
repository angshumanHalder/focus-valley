import { SubmitEvent, useEffect, useReducer, useRef, useState } from "react";
import { initialTimer, timerReducer, type CompletedFocus } from "../reducers/timer";

type FocusFormProps = {
  target: FocusTarget | null;
  onFocusComplete: (focus: CompletedFocus) => void;
  onFocusStart: (target: FocusTarget) => void;
  onFocusActiveChange: (active: boolean) => void;
  onFocusRunningChange: (running: boolean) => void;
  onFocusPreview: (intervals: RunningInterval[]) => void;
  plantedSeconds: number;
  simulation?: boolean;
};

export const FocusForm = ({ target, onFocusComplete, onFocusStart, onFocusActiveChange, onFocusRunningChange, onFocusPreview, plantedSeconds, simulation = false }: FocusFormProps) => {
  const [timer, dispatch] = useReducer(timerReducer, initialTimer);
  const handledCompletions = useRef(0);
  const handledStart = useRef("");
  const [now, setNow] = useState(Date.now);
  const [duration, setDuration] = useState("25");
  const [customMinutes, setCustomMinutes] = useState("30");
  const [label, setLabel] = useState(simulation ? "Simulation task" : "");

  useEffect(() => {
    if (simulation || timer.status !== "running") return;
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      dispatch({ type: "tick", now: time });
    }, 250);
    return () => window.clearInterval(interval);
  }, [timer.status, simulation]);

  useEffect(() => {
    if (timer.lastCompletedFocus && handledCompletions.current < timer.completedFocusDurationsMs.length) {
      handledCompletions.current = timer.completedFocusDurationsMs.length;
      onFocusComplete(timer.lastCompletedFocus);
    }
  }, [timer.lastCompletedFocus, timer.completedFocusDurationsMs.length, onFocusComplete]);

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
    const time = simulation ? now : Date.now();
    setNow(time);
    if (!target) return;
    dispatch({ type: "startFocus", id: crypto.randomUUID(), label, minutes, now: time, target });
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
    const time = simulation ? now : Date.now();
    setNow(time);
    dispatch({ type, now: time });
  };

  const advance = (milliseconds: number) => {
    const time = now + milliseconds;
    setNow(time);
    dispatch({ type: "tick", now: time });
  };

  return (
    <>
      <h2 id="timer-heading">Focus timer</h2>
      {simulation && <section className="simulation-clock" aria-label="Simulation clock">
        <p>Time advances only with these controls. Pause and cancel use the normal game rules.</p>
        <div className="choices">
          <button type="button" onClick={() => advance(1000)} disabled={timer.status === "idle"}>+1 second</button>
          <button type="button" onClick={() => advance(60_000)} disabled={timer.status === "idle"}>+1 minute</button>
          <button type="button" onClick={() => advance(300_000)} disabled={timer.status === "idle"}>+5 minutes</button>
          <button type="button" onClick={() => advance(Math.max(0, timer.deadline - now))} disabled={timer.status !== "running"}>Finish current timer</button>
        </div>
      </section>}
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
      <p className="session-count">
        Completed focus sessions: {timer.completedFocusDurationsMs.length}
      </p>
    </>
  );
};
