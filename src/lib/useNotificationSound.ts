"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_STORAGE_KEY = "upcome:sound-muted:v1";
/** Don't fire more than one blip inside this window (feeds can burst). */
const THROTTLE_MS = 120;

function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A short terminal "blip" played when a new event lands, with a persisted
 * mute toggle.
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Crisp, un-annoying two-note blip.
      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(990, t + 0.06);

      // Fast attack, quick exponential decay.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
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
