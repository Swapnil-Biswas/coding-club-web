"use client";

import { useEffect } from "react";

/**
 * Mobile tap-to-colour toggle for the global grayscale image effect.
 *
 * On touch devices:
 *   - First tap on an image adds `.img-colored` → full colour
 *   - Second tap (or tap elsewhere) removes it → back to grayscale
 *
 * Gallery grid images are excluded — they are always full colour via CSS.
 */
export default function GrayscaleTouch() {
  useEffect(() => {
    // Only activate on touch-primary devices
    if (!("ontouchstart" in window)) return;

    let activeImg: HTMLImageElement | null = null;

    function handleTouch(e: TouchEvent) {
      const target = e.target as Element;
      const img = target.closest("img") as HTMLImageElement | null;

      // Tapped on an image that isn't in the gallery grid
      if (img && !img.closest(".gallery-grid")) {
        if (img === activeImg) {
          // Second tap on same image — toggle off
          img.classList.remove("img-colored");
          activeImg = null;
        } else {
          // New image tapped — deactivate previous, activate this one
          if (activeImg) activeImg.classList.remove("img-colored");
          img.classList.add("img-colored");
          activeImg = img;
        }
        e.preventDefault(); // prevent the ghost mouse click
        return;
      }

      // Tapped somewhere else — deactivate the active image
      if (activeImg) {
        activeImg.classList.remove("img-colored");
        activeImg = null;
      }
    }

    document.addEventListener("touchstart", handleTouch, { passive: false });
    return () => document.removeEventListener("touchstart", handleTouch);
  }, []);

  return null;
}
