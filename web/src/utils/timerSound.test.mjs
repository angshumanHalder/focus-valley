import assert from "node:assert/strict";
import test from "node:test";
import { playTimerSound } from "./timerSound.ts";

test("timer cues are quiet, distinct, and stop after playing", () => {
  const notes = [];
  const context = {
    currentTime: 10,
    destination: {},
    createOscillator() {
      const note = { frequency: { value: 0 }, connect() {}, start(at) { note.startAt = at; }, stop(at) { note.stopAt = at; } };
      notes.push(note);
      return note;
    },
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime(level) { assert.ok(level <= 0.1); }, exponentialRampToValueAtTime() {} }, connect() {} };
    },
  };

  playTimerSound(context, "start");
  assert.equal(notes.length, 1);
  const startFrequency = notes[0].frequency.value;
  playTimerSound(context, "end");
  assert.equal(notes.length, 3);
  assert.notEqual(notes[1].frequency.value, startFrequency);
  assert.ok(notes.every(note => note.stopAt > note.startAt && note.stopAt - note.startAt < 0.25));
});
