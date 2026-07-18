"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_STORAGE_KEY = "upcome:sound-muted:v1";
/** Don't fire more than one blip inside this window (feeds can burst). */
const THROTTLE_MS = 150;

function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A short terminal alert played when a new event lands, with a persisted
 * mute toggle.
 *
 * The tone is modelled on a trading-terminal message chime: a crisp, dry
 * two-note "di-dit" (a rising perfect fourth) built from square-wave blips and
 * run through a lowpass filter so it reads as a bright electronic alert rather
 * than a harsh beep. It's short enough to fire on a busy wire without becoming
 * grating.
 *
 * The sound is synthesised with the Web Audio API so there's no audio asset to
 * ship. The AudioContext is created lazily on the first {@link play} call —
 * by then the user has already interacted with the page (login), so browser
 * autoplay policies let it through; we still `resume()` defensively.
 */
export function useNotificationSound() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef(0);
  const mutedRef = useRef(false);

  // Hydrate the persisted preference on mount (client only).
  useEffect(() => {
    const initial = loadMuted();
    setMuted(initial);
    mutedRef.current = initial;
  }, []);

  const play = useCallback(() => {
    if (mutedRef.current) return;
    if (typeof window === "undefined") return;

    const now = Date.now();
    if (now - lastPlayedRef.current < THROTTLE_MS) return;
    lastPlayedRef.current = now;

    try {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = new AudioCtx();
        ctxRef.current = ctx;
      }
      // A context can start (or get parked) in "suspended" state until a user
      // gesture; nudge it back to life before scheduling.
      if (ctx.state === "suspended") void ctx.resume();

      const t = ctx.currentTime;

      // A lowpass filter tames the square waves' upper harmonics so the alert
      // sounds like a warm terminal chime rather than a piercing beep.
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2600, t);
      filter.Q.setValueAtTime(0.7, t);
      filter.connect(ctx.destination);

      // One short square-wave blip at a fixed pitch. Fast attack, brief
      // sustain, quick exponential release — dry and clicky like a wire tick.
      const blip = (freq: number, start: number, dur: number, peak: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
        gain.gain.setValueAtTime(peak, start + dur * 0.55);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(filter);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      };

      // "Di-dit" — a rising perfect fourth (B5 → E6). The second note is a hair
      // brighter and shorter, giving the chime its signature terminal snap.
      blip(987.77, t, 0.055, 0.11);
      blip(1318.51, t + 0.072, 0.075, 0.12);
    } catch {
      /* audio is best-effort — never let it break the feed */
    }
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  }, []);

  return { play, muted, toggleMuted };
}
