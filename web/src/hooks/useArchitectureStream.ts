import { useEffect, useState } from "react";

export type ArchitecturePayload = {
  serverTime: number;
  ingest: { lastIngestAt: number | null; hasLiveIngest: boolean };
  signals: {
    tabSwitchesPerMin: number;
    dwellSeconds: number;
    backtrackRatio: number;
    activeDomain: string;
    activeTitle: string;
    hasLiveIngest: boolean;
  };
  neuroScore: {
    focus: number;
    stress: number;
    confusion: number;
    label: string;
    deepFocusSuggested: boolean;
  };
  intent: { intent: string; confidence: number };
  prediction: {
    taskLabel: string;
    estimatedMinutesRemaining: number;
    confidence: number;
    rationale: string;
  };
  notifications: {
    queueSize: number;
    gmailConnected: boolean;
    gmailEmail: string | null;
    gmailFetchedAt: number | null;
    inboxSource: string;
  };
  dna: { delayed: number; batched: number; shown: number; failSafeConfidence: number };
  agent: { total: number; pending: number; needsApproval: number; running: number };
  flows: { activeAutomations: number; streamIntervalMs: number };
};

export function useArchitectureStream() {
  const [data, setData] = useState<ArchitecturePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/architecture/stream");
    es.onopen = () => {
      setConnected(true);
      setErr(null);
    };
    es.onmessage = (ev) => {
      try {
        setData(JSON.parse(ev.data) as ArchitecturePayload);
        setErr(null);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      setConnected(false);
      setErr("Connect the API (port 3847) for live architecture.");
    };
    return () => es.close();
  }, []);

  return { data, err, connected };
}
