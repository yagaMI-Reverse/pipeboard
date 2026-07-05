import { Code2, Workflow } from "lucide-react";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2.5 text-lg font-bold">
          <span className="panel flex h-10 w-10 items-center justify-center rounded-lg">
            <Workflow size={19} className="text-run" aria-hidden />
          </span>
          pipe<span className="text-run glow-run">board</span>
        </span>
        <a
          href="https://github.com/yagaMI-Reverse"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub profile"
          className="panel flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
        >
          <Code2 size={17} strokeWidth={1.75} aria-hidden />
        </a>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4">
        <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-4xl">
          Watch an async pipeline{" "}
          <span className="text-run glow-run">survive chaos</span> — live.
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted sm:text-[15px]">
          A real job queue streamed over SSE: 3 workers, exponential backoff
          with jitter, max-3 retries, dead-letter. Run the chaos scenario — the
          provider starts failing 65% of calls, a worker dies mid-job — and
          watch the system absorb it instead of losing data. This is the state
          machine behind every reliable Celery / BullMQ / RQ deployment.
        </p>
      </section>

      <Dashboard />

      <footer className="border-t border-line py-7">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted">
          <p>
            Built by{" "}
            <a
              href="https://github.com/yagaMI-Reverse"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Ilya Shapovalov
            </a>{" "}
            — Next.js 16 · Server-Sent Events · queue state machine
          </p>
          <p>No fake data: every event you see is emitted by the live engine.</p>
        </div>
      </footer>
    </main>
  );
}
