export function prepareCompletionSound(): AudioContext | null {
  try {
    const context = new AudioContext();
    void context.resume();
    return context;
  } catch {
    return null;
  }
}
export function playCompletionSound(context: AudioContext | null) {
  if (!context || context.state === "closed") return;
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.setValueAtTime(880, context.currentTime + 0.1);
  gain.gain.setValueAtTime(0.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.23);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.25);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    void context.close();
  };
}
