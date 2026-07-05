"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Flame,
  Play,
  RotateCcw,
  Server,
  Skull,
  Terminal,
} from "lucide-react";
import type { Job, JobState, Snapshot, Scenario } from "@/lib/types";

const COLUMNS: { state: JobState; title: string; accent: string }[] = [
  { state: "queued", title: "QUEUED", accent: "text-muted" },
  { state: "running", title: "RUNNING", accent: "text-run glow-run" },
  { state: "retrying", title: "RETRYING", accent: "text-warn glow-warn" },
  { state: "done", title: "DONE", accent: "text-run" },
  { state: "dead", title: "DEAD-LETTER", accent: "text-fail glow-fail" },
];

const chipCls: Record<JobState, string> = {
  queued: "border-line text-muted",
  running: "border-run/50 text-run bg-run/10",
  retrying: "border-warn/50 text-warn bg-warn/10",
  done: "border-run/30 text-run/70 bg-run/5",
  dead: "border-fail/50 text-fail bg-fail/10",
};

function logColor(line: string): string {
  if (line.includes("✗") || line.includes("DIED") || line.includes("dead-letter"))
    return "text-fail";
  if (line.includes("⚠") || line.includes("backoff") || line.includes("DEGRADED"))
    return "text-warn";
  if (line.includes("✓")) return "text-run";
  return "text-muted";
}

export default function Dashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("chaos");
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  function start() {
    esRef.current?.close();
    setSnap(null);
    setLogLines([]);
    setRunning(true);
    const es = new EventSource(`/api/run?scenario=${scenario}&jobs=24`);
    esRef.current = es;
    es.onmessage = (e) => {
      const s: Snapshot = JSON.parse(e.data);
      setSnap(s);
      if (s.log.length) setLogLines((prev) => [...prev, ...s.log].slice(-200));
      if (s.finished) {
        es.close();
        setRunning(false);
      }
    };
    es.onerror = () => {
      es.close();
      setRunning(false);
    };
  }

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logLines]);

  const jobsBy = (state: JobState): Job[] =>
    snap?.jobs.filter((j) => j.state === state) ?? [];

  const m = snap?.metrics;
  const degraded = (snap?.metrics.errorRate ?? 0) > 0.4;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-16">
      {/* controls */}
      <div className="panel flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="flex gap-2" role="group" aria-label="Scenario">
          <button
            type="button"
            onClick={() => setScenario("calm")}
            aria-pressed={scenario === "calm"}
            className={`h-10 cursor-pointer rounded-lg border px-4 text-sm font-medium transition-colors ${
              scenario === "calm"
                ? "border-run/60 bg-run/10 text-run"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            calm run
          </button>
          <button
            type="button"
            onClick={() => setScenario("chaos")}
            aria-pressed={scenario === "chaos"}
            className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors ${
              scenario === "chaos"
                ? "border-warn/60 bg-warn/10 text-warn"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            <Flame size={14} aria-hidden />
            chaos run
          </button>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-run px-5 text-sm font-bold text-background transition-all hover:brightness-110 active:scale-[.98] disabled:cursor-default disabled:opacity-50"
        >
          {running ? (
            <>
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-background" />
              streaming…
            </>
          ) : snap ? (
            <>
              <RotateCcw size={15} aria-hidden /> restart
            </>
          ) : (
            <>
              <Play size={15} aria-hidden /> start run
            </>
          )}
        </button>
        {snap && (
          <span
            className={`ml-auto rounded-full border px-3.5 py-1.5 text-xs font-bold ${
              degraded
                ? "border-warn/50 text-warn glow-warn"
                : "border-run/40 text-run"
            }`}
          >
            {snap.phase} · t={snap.t.toFixed(1)}s
          </span>
        )}
      </div>

      {/* metrics */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "jobs", value: m?.total ?? "—", cls: "" },
          { label: "done", value: m?.done ?? "—", cls: "text-run" },
          { label: "in flight", value: m?.inFlight ?? "—", cls: "text-run" },
          { label: "retries", value: m?.retries ?? "—", cls: "text-warn" },
          { label: "dead", value: m?.dead ?? "—", cls: "text-fail" },
          {
            label: "error rate",
            value: m ? `${Math.round(m.errorRate * 100)}%` : "—",
            cls: degraded ? "text-warn glow-warn" : "text-run",
          },
        ].map((k) => (
          <div key={k.label} className="panel rounded-xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* board */}
      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = jobsBy(col.state);
          return (
            <div key={col.state} className="panel min-h-[180px] rounded-xl p-3">
              <p className={`mb-2.5 flex items-center justify-between text-[11px] font-bold tracking-wider ${col.accent}`}>
                {col.title}
                <span className="tabular-nums">{items.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                <AnimatePresence mode="popLayout">
                  {items.map((j) => (
                    <motion.span
                      key={j.id}
                      layout
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      title={`${j.name} · attempts ${j.attempts}`}
                      className={`rounded-md border px-2 py-1 text-[11px] tabular-nums ${chipCls[j.state]}`}
                    >
                      #{j.id}
                      {j.attempts > 0 && col.state !== "done" ? `·${j.attempts}` : ""}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* workers */}
        <div className="panel rounded-xl p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-muted">
            <Server size={14} aria-hidden /> WORKER POOL
          </p>
          <div className="flex flex-col gap-2.5">
            {(snap?.workers ?? [{ id: "w1" }, { id: "w2" }, { id: "w3" }]).map(
              (w) => {
                const state = "state" in w ? w.state : "idle";
                const job = "job" in w ? w.job : null;
                const processed = "processed" in w ? w.processed : 0;
                return (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm ${
                      state === "dead"
                        ? "border-fail/40 bg-fail/5"
                        : state === "busy"
                          ? "border-run/30 bg-run/5"
                          : "border-line"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 font-bold">
                      {state === "dead" ? (
                        <Skull size={15} className="text-fail" aria-hidden />
                      ) : (
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            state === "busy" ? "bg-run pulse-dot" : "bg-muted/50"
                          }`}
                          aria-hidden
                        />
                      )}
                      {w.id}
                    </span>
                    <span
                      className={`text-xs ${state === "dead" ? "text-fail" : "text-muted"}`}
                    >
                      {state === "dead"
                        ? "DEAD"
                        : job
                          ? `job #${job}`
                          : "idle"}
                      {" · "}
                      <span className="tabular-nums">{processed} done</span>
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* log */}
        <div className="panel flex h-[260px] flex-col rounded-xl p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-muted">
            <Terminal size={14} aria-hidden /> LIVE LOG
          </p>
          <div
            ref={logRef}
            className="log-scroll flex-1 overflow-y-auto pr-2 text-[12px] leading-relaxed"
            aria-live="polite"
          >
            {logLines.length === 0 && (
              <p className="text-muted">
                Press <span className="text-run">start run</span> — every queue
                event streams here in real time.
              </p>
            )}
            {logLines.map((line, i) => (
              <p key={i} className={logColor(line)}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {snap?.finished && (
        <div className="panel flex items-center gap-3 rounded-xl border-run/30 p-4 text-sm">
          <Activity size={17} className="text-run" aria-hidden />
          <p>
            Run complete: <b className="text-run">{m?.done}</b> done,{" "}
            <b className="text-warn">{m?.retries}</b> retries absorbed,{" "}
            <b className="text-fail">{m?.dead}</b> dead-lettered out of {m?.total}{" "}
            jobs — the pipeline survived{scenario === "chaos" ? " a provider outage and a worker crash" : " a healthy run"}.
          </p>
        </div>
      )}
    </div>
  );
}
