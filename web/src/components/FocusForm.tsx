import { SubmitEvent, useEffect, useReducer, useState } from "react";
import { initialTimer, timerReducer } from "../reducers/timer";

export const FocusForm = () => {
  const [timer, dispatch] = useReducer(timerReducer, initialTimer);
  const [now, setNow] = useState(Date.now);
  const [duration, setDuration] = useState("25");
  const [customMinutes, setCustomMinutes] = useState("30");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      dispatch({ type: "tick", now: time });
    }, 250);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  const startFocus = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minutes = Number(duration === "custom" ? customMinutes : duration);
    const time = Date.now();
    setNow(time);
    dispatch({ type: "startFocus", label, minutes, now: time });
  };

  const remainingMs =
    timer.status === "running"
      ? Math.max(0, timer.deadline - now)
      : timer.status === "paused"
        ? timer.remainingMs
        : 0;

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
                  value="1"
                  checked={duration === "1"}
                  onChange={() => setDuration("1")}
                />{" "}
                1 min
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
                min="1"
                max="240"
                required
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
              />
            </div>
          )}
          <button type="submit" className="primary">
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
