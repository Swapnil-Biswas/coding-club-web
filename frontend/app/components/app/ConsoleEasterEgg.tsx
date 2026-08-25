"use client";

import { useEffect } from "react";
import { initConsoleEasterEgg } from "../../lib/easterEggs/consoleBanner";
import { useKonamiCode } from "../../lib/easterEggs/useKonamiCode";
import ArcadeModal from "../easterEggs/ArcadeModal";

export default function ConsoleEasterEgg() {
  const { isUnlocked, close } = useKonamiCode();

  useEffect(() => {
    initConsoleEasterEgg();
  }, []);

  return <ArcadeModal isOpen={isUnlocked} onClose={close} />;
}
