/** Start speech with a bounded wait and observable failures, never a silent skip. */
export function startSpeechPlayback(
  synth: Pick<SpeechSynthesis, 'resume' | 'speak'>,
  utterance: SpeechSynthesisUtterance,
  callbacks: { onStart: () => void; onEnd: () => void; onError: (reason: string) => void },
  startTimeoutMs = 8000,
) {
  let stopped = false;
  const finish = (reason?: string) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (reason) callbacks.onError(reason); else callbacks.onEnd();
  };
  const timer = setTimeout(() => finish('start-timeout'), startTimeoutMs);
  utterance.onstart = () => { if (!stopped) { clearTimeout(timer); callbacks.onStart(); } };
  utterance.onend = () => finish();
  utterance.onerror = (event) => finish(event.error || 'speech-failed');
  try { synth.resume(); synth.speak(utterance); } catch { finish('speech-failed'); }
  return () => {
    stopped = true;
    clearTimeout(timer);
    utterance.onstart = null; utterance.onend = null; utterance.onerror = null;
  };
}

let audioContext: AudioContext | null = null;
export function playNotificationChime(): Promise<boolean> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return Promise.resolve(false);
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
    const ctx = audioContext!;
    // resume() is invoked synchronously by the user's enable/replay gesture.
    const ready = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    return ready.then(() => {
      if (ctx.state !== 'running') return false;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(); osc.stop(ctx.currentTime + 0.55);
      return true;
    }).catch(() => false);
  } catch { return Promise.resolve(false); }
}
