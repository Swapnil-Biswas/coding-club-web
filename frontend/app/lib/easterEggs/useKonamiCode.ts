"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { arcadeSound } from "./soundSynth";

const KONAMI_CODE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowleft",
  "arrowright",
  "arrowright",
];

export function useKonamiCode(onUnlock?: () => void) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const bufferRef = useRef<string[]>([]);

  const unlock = useCallback(() => {
    arcadeSound.powerUp();
    setIsUnlocked(true);
    if (onUnlock) onUnlock();
  }, [onUnlock]);

  const close = useCallback(() => {
    setIsUnlocked(false);
    bufferRef.current = [];
  }, []);

  useEffect(() => {
    // Expose global trigger for bmsit.arcade() in DevTools
    if (typeof window !== "undefined") {
      (window as unknown as { __BMSIT_EASTER_OPEN_ARCADE__?: () => void }).__BMSIT_EASTER_OPEN_ARCADE__ = () => {
        unlock();
      };
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in a standard input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const nextBuffer = [...bufferRef.current, key].slice(-KONAMI_CODE.length);
      bufferRef.current = nextBuffer;

      // Check if buffer matches Konami Code
      if (nextBuffer.length === KONAMI_CODE.length) {
        const isMatch = nextBuffer.every((k, idx) => k === KONAMI_CODE[idx]);
        if (isMatch) {
          e.preventDefault();
          bufferRef.current = [];
          unlock();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [unlock]);

  return { isUnlocked, unlock, close };
}
