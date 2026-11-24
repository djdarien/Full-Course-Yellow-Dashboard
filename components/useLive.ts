"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveSnapshot, RadioCapture, RcMessage, TimedSnapshot } from "@/lib/types";

export function useLive(delaySec: number) {
  const [snapshots, setSnapshots] = useState<TimedSnapshot[]>([]);
  const [messages, setMessages] = useState<RcMessage[]>([]);
  const [radios, setRadios] = useState<RadioCapture[]>([]);
  const [stream, setStream] = useState<"connecting" | "open" | "closed">("connecting");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/live");
    const bootstrap = (event: Event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        history: TimedSnapshot[];
        messages: RcMessage[];
        radios: RadioCapture[];
      };
      setSnapshots(data.history ?? []);
      setMessages(data.messages ?? []);
      setRadios(data.radios ?? []);
      setStream("open");
    };
    const snapshot = (event: Event) => {
      const data = JSON.parse((event as MessageEvent).data) as TimedSnapshot;
      setSnapshots((current) => {
        const next = current.slice();
        const last = next[next.length - 1];
        if (last && data.t - last.t < 400) next[next.length - 1] = data;
        else next.push(data);
        const cutoff = Date.now() - 130_000;
        while (next.length > 2 && next[0].t < cutoff) next.shift();
        return next;
      });
      setStream("open");
    };
    const rc = (event: Event) => {
      const message = JSON.parse((event as MessageEvent).data) as RcMessage;
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message].slice(-400)));
    };
    const radio = (event: Event) => {
      const item = JSON.parse((event as MessageEvent).data) as RadioCapture;
      setRadios((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item].slice(-200)));
    };
    source.addEventListener("bootstrap", bootstrap);
    source.addEventListener("snapshot", snapshot);
    source.addEventListener("rc", rc);
    source.addEventListener("radio", radio);
    source.onerror = () => setStream("closed");
    return () => source.close();
  }, []);

  const viewTime = now - delaySec * 1000;
  const snapshot = useMemo(() => {
    let chosen: LiveSnapshot | null = null;
    for (const item of snapshots) {
      if (item.t <= viewTime) chosen = item.snapshot;
      else break;
    }
    return chosen;
  }, [snapshots, viewTime]);

  const visibleMessages = useMemo(() => messages.filter((message) => message.t <= viewTime), [messages, viewTime]);
  const visibleRadios = useMemo(() => radios.filter((radio) => radio.t <= viewTime), [radios, viewTime]);
  const holding = delaySec > 0 && snapshots.length > 0 && snapshots[0].t > viewTime;
  const holdFor = holding ? Math.max(1, Math.ceil((snapshots[0].t - viewTime) / 1000)) : 0;

  return { snapshot, messages: visibleMessages, radios: visibleRadios, stream, viewTime, holding, holdFor };
}
