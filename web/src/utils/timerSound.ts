export function playTimerSound(context: AudioContext, cue: "start" | "end") {
  const notes = cue === "start" ? [523.25] : [659.25, 783.99];
  notes.forEach((frequency, index) => {
    const at = context.currentTime + index * 0.14;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.linearRampToValueAtTime(0.07, at + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.19);
  });
}
