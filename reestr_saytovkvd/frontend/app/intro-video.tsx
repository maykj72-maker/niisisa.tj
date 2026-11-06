"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const SEEN_KEY = "niisa_intro_seen";
const START_TIMEOUT_MS = 5000;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSeen() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage can be blocked; the intro then simply closes for this view.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Full-screen intro video shown once per browser session, then the site.
 * Put the file at public/intro.mp4. If it is missing, fails to load or does not
 * start within a few seconds, the intro is skipped and the site opens as usual.
 */
export default function IntroVideo() {
  const seen = useSyncExternalStore(subscribe, getSeen, () => false);
  const [closing, setClosing] = useState(false);
  const [started, setStarted] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  const close = () => {
    setClosing(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(markSeen, 700);
  };

  useEffect(() => {
    if (seen) return;
    // The error event can fire before React attaches handlers on the server-rendered <video>.
    if (videoRef.current?.error) {
      markSeen();
      return;
    }
    const timer = window.setTimeout(() => {
      if (!document.querySelector<HTMLVideoElement>(".intro-video__media[data-playing='1']")) markSeen();
    }, START_TIMEOUT_MS);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.documentElement.style.overflow = "";
    };
  }, [seen]);

  if (seen) return null;

  return (
    <div className={`intro-video${closing ? " intro-video--closing" : ""}`} role="dialog" aria-label="Вступительное видео">
      <video
        ref={videoRef}
        className="intro-video__media"
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        data-playing={started ? "1" : "0"}
        onPlaying={() => setStarted(true)}
        onEnded={close}
        onError={markSeen}
      />
      <button type="button" className="intro-video__skip" onClick={close}>
        Пропустить
      </button>
    </div>
  );
}
