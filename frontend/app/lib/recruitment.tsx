"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/app/lib/api";

export interface RecruitmentState {
  is_open: boolean;
  cycle_id: string;
  title: string;
  announcement_version: number;
}

interface RecruitmentContextValue {
  state: RecruitmentState | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const RecruitmentContext = createContext<RecruitmentContextValue | null>(null);

const SESSION_DISMISSED_KEY = "cc_recruitment_dismissed_v";

export function RecruitmentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecruitmentState | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ recruitment: RecruitmentState | null }>("/recruitment/state");
      setState(data.recruitment);
    } catch {
      setState(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ state, ready, refresh }), [state, ready, refresh]);

  return (
    <RecruitmentContext.Provider value={value}>
      {children}
    </RecruitmentContext.Provider>
  );
}

export function useRecruitment(): RecruitmentContextValue {
  const ctx = useContext(RecruitmentContext);
  if (!ctx) throw new Error("useRecruitment must be inside <RecruitmentProvider>");
  return ctx;
}

// Returns true if the announcement should be shown to this visitor.
// Shows once per session; shows again when announcement_version changes.
export function useShouldShowAnnouncement(state: RecruitmentState | null): {
  shouldShow: boolean;
  dismiss: () => void;
} {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    if (!state?.is_open) {
      setDismissed(true);
      return;
    }
    const key = `${SESSION_DISMISSED_KEY}${state.announcement_version}`;
    const alreadyDismissed = sessionStorage.getItem(key) === "1";
    setDismissed(alreadyDismissed);
  }, [state]);

  const dismiss = useCallback(() => {
    if (!state) return;
    const key = `${SESSION_DISMISSED_KEY}${state.announcement_version}`;
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  }, [state]);

  return { shouldShow: !dismissed && Boolean(state?.is_open), dismiss };
}
