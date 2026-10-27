// src/lib/audio-feedback.ts

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isScannerMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("pos_scanner_sound_muted") === "true";
}

export function setScannerMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_scanner_sound_muted", muted ? "true" : "false");
}

/**
 * Plays a crisp, professional POS scan success beep (high frequency sine chirp).
 */
export function playScanSuccessBeep(): void {
  if (isScannerMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note (high, clean)

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (err) {
    console.warn("Audio feedback error:", err);
  }
}

/**
 * Plays a low-frequency alert buzz for scan failures or stock limits.
 */
export function playScanErrorBeep(): void {
  if (isScannerMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (err) {
    console.warn("Audio feedback error:", err);
  }
}
