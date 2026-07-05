import type {
  Job,
  Metrics,
  Scenario,
  Snapshot,
  WorkerInfo,
} from "@/lib/types";

// One SSE connection = one live pipeline run. The state machine below is the
// same shape you'd run on Celery/RQ/BullMQ workers: pull from queue, process,
// retry with exponential backoff + jitter, dead-letter after max attempts.
export const maxDuration = 60;

const TICK_MS = 120;
const SNAPSHOT_EVERY = 3; // ticks
const MAX_ATTEMPTS = 3;
const RUN_LIMIT_S = 48;

const JOB_NAMES = [
  "translate-chapter",
  "embed-document",
  "render-invoice",
  "sync-inventory",
  "score-lead",
  "extract-fields",
  "notify-user",
  "generate-listing",
];

function jitter(base: number): number {
  return base * (0.7 + Math.random() * 0.6);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scenario = (url.searchParams.get("scenario") === "chaos"
    ? "chaos"
    : "calm") as Scenario;
  const jobCount = Math.min(
    48,
    Math.max(8, Number(url.searchParams.get("jobs")) || 24)
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (snap: Snapshot) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snap)}\n\n`));

      // ---- state ----
      const jobs: Job[] = Array.from({ length: jobCount }, (_, i) => ({
        id: i + 1,
        name: `${JOB_NAMES[i % JOB_NAMES.length]}#${i + 1}`,
        state: "queued",
        attempts: 0,
        worker: null,
      }));
      const workers: WorkerInfo[] = ["w1", "w2", "w3"].map((id) => ({
        id,
        state: "idle",
        job: null,
        processed: 0,
      }));
      let retriesTotal = 0;
      const pendingLog: string[] = [];
      const finishAt = new Map<number, number>(); // jobId -> tick when processing completes
      const retryAt = new Map<number, number>(); // jobId -> tick when retry re-queues
      let tick = 0;

      const log = (line: string) =>
        pendingLog.push(`[${(tick * TICK_MS / 1000).toFixed(1).padStart(5)}s] ${line}`);

      const errorRate = (): number => {
        const t = (tick * TICK_MS) / 1000;
        if (scenario === "calm") return 0.12;
        if (t < 10) return 0.15;
        if (t < 26) return 0.65; // provider degraded
        return 0.08; // recovered
      };
      const phaseName = (): string => {
        const t = (tick * TICK_MS) / 1000;
        if (scenario === "calm") return "provider healthy";
        if (t < 10) return "provider healthy";
        if (t < 26) return "PROVIDER DEGRADED (65% errors)";
        return "provider recovered";
      };

      log(
        `run started — ${jobCount} jobs, 3 workers, scenario: ${scenario.toUpperCase()}`
      );
      if (scenario === "chaos")
        log("chaos timeline: provider degrades at 10s, worker w2 dies at 16s, both recover later");

      const snapshot = (finished: boolean): Snapshot => {
        const metrics: Metrics = {
          total: jobCount,
          done: jobs.filter((j) => j.state === "done").length,
          dead: jobs.filter((j) => j.state === "dead").length,
          retries: retriesTotal,
          inFlight: jobs.filter((j) => j.state === "running").length,
          errorRate: errorRate(),
        };
        const snap: Snapshot = {
          t: (tick * TICK_MS) / 1000,
          phase: phaseName(),
          jobs: [...jobs],
          workers: workers.map((w) => ({ ...w })),
          metrics,
          log: pendingLog.splice(0),
          finished,
        };
        return snap;
      };

      const aborted = { value: false };
      request.signal.addEventListener("abort", () => {
        aborted.value = true;
      });

      while (!aborted.value) {
        tick += 1;
        const tSec = (tick * TICK_MS) / 1000;

        // chaos: worker lifecycle
        if (scenario === "chaos") {
          const w2 = workers[1];
          if (tSec >= 16 && tSec < 30 && w2.state !== "dead") {
            if (w2.job !== null) {
              const j = jobs.find((x) => x.id === w2.job);
              if (j) {
                j.state = "queued";
                j.worker = null;
                finishAt.delete(j.id);
                log(`⚠ worker w2 DIED mid-job — ${j.name} re-queued (idempotency key reused)`);
              }
            } else {
              log("⚠ worker w2 DIED");
            }
            w2.state = "dead";
            w2.job = null;
          }
          if (tSec >= 30 && w2.state === "dead") {
            w2.state = "idle";
            log("✓ worker w2 recovered and rejoined the pool");
          }
        }

        // retries re-queue
        for (const [jobId, at] of retryAt) {
          if (tick >= at) {
            const j = jobs.find((x) => x.id === jobId);
            if (j && j.state === "retrying") {
              j.state = "queued";
              log(`${j.name} back in queue (attempt ${j.attempts + 1}/${MAX_ATTEMPTS})`);
            }
            retryAt.delete(jobId);
          }
        }

        // finish running jobs
        for (const [jobId, at] of finishAt) {
          if (tick >= at) {
            const j = jobs.find((x) => x.id === jobId);
            const w = workers.find((x) => x.job === jobId);
            if (j && j.state === "running") {
              const failed = Math.random() < errorRate();
              if (failed) {
                j.attempts += 1;
                if (j.attempts >= MAX_ATTEMPTS) {
                  j.state = "dead";
                  j.worker = null;
                  log(`✗ ${j.name} FAILED ${MAX_ATTEMPTS}x — moved to dead-letter`);
                } else {
                  j.state = "retrying";
                  j.worker = null;
                  retriesTotal += 1;
                  const backoff = jitter(800 * 2 ** j.attempts);
                  retryAt.set(j.id, tick + Math.round(backoff / TICK_MS));
                  log(
                    `✗ ${j.name} failed on ${w?.id ?? "?"} (provider 503) — backoff ${(backoff / 1000).toFixed(1)}s`
                  );
                }
              } else {
                j.state = "done";
                j.worker = null;
                if (w) w.processed += 1;
                log(`✓ ${j.name} done on ${w?.id ?? "?"}`);
              }
            }
            if (w) {
              w.job = null;
              if (w.state === "busy") w.state = "idle";
            }
            finishAt.delete(jobId);
          }
        }

        // assign queued jobs to idle workers
        for (const w of workers) {
          if (w.state !== "idle") continue;
          const j = jobs.find((x) => x.state === "queued");
          if (!j) break;
          j.state = "running";
          j.worker = w.id;
          w.state = "busy";
          w.job = j.id;
          finishAt.set(j.id, tick + Math.round(jitter(1800) / TICK_MS));
        }

        const allTerminal = jobs.every(
          (j) => j.state === "done" || j.state === "dead"
        );

        if (tick % SNAPSHOT_EVERY === 0 || allTerminal) {
          try {
            send(snapshot(allTerminal));
          } catch {
            break; // client disconnected
          }
        }

        if (allTerminal) {
          log("run complete");
          try {
            send(snapshot(true));
          } catch {
            /* ignore */
          }
          break;
        }
        if (tSec > RUN_LIMIT_S) {
          log("run time limit reached — closing stream");
          try {
            send(snapshot(true));
          } catch {
            /* ignore */
          }
          break;
        }

        await new Promise((r) => setTimeout(r, TICK_MS));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
