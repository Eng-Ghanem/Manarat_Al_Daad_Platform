// Web Audio API Bell Chime Synthesizer ("طن")
// Generates a crystal-clear, luxurious, physically-modeled bell chime
// with zero latency and no external audio file dependencies.

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Ensure audio context is unlocked on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (_) {}
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

export const isNotificationSoundEnabled = () => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('manarat_notif_sound_enabled');
  return stored === null ? true : stored === 'true';
};

export const setNotificationSoundEnabled = (enabled) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('manarat_notif_sound_enabled', enabled ? 'true' : 'false');
};

/**
 * Plays the signature "طن" bell chime.
 * Models a warm, resonant brass/crystal bell with multiple harmonic partials
 * and smooth exponential decay.
 */
export const playChimeSound = (force = false) => {
  if (!force && !isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playChimeSound(true)).catch(() => {});
      return;
    }

    const now = ctx.currentTime;

    // Master Gain for smooth volume control
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // Harmonic partials for a rich bell sound ("طن"):
    // 1. Fundamental tone: ~987.77 Hz (B5 note) - crystalline and pleasant
    // 2. Secondary harmonic: ~1975.5 Hz (B6 note) - bright shimmer
    // 3. Minor third harmonic: ~1174.66 Hz (D6 note) - bell resonance
    // 4. Subtle sub-harmonic: ~493.88 Hz (B4 note) - body & depth
    const partials = [
      { freq: 987.77, gain: 0.5, decay: 1.1, type: 'sine' },
      { freq: 1975.53, gain: 0.25, decay: 0.8, type: 'sine' },
      { freq: 1174.66, gain: 0.2, decay: 0.9, type: 'sine' },
      { freq: 493.88, gain: 0.35, decay: 1.3, type: 'triangle' }
    ];

    partials.forEach(({ freq, gain, decay, type }) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = type;
      // Slight pitch glide on attack for authentic strike feel
      osc.frequency.setValueAtTime(freq * 1.01, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.04);

      // Instant strike attack (0.005s) then smooth exponential decay
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.exponentialRampToValueAtTime(gain, now + 0.008);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + decay + 0.05);
    });

  } catch (err) {
    console.warn('Notification chime audio warning:', err);
  }
};
