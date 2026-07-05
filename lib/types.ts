export type JobState = "queued" | "running" | "retrying" | "done" | "dead";
export type WorkerState = "idle" | "busy" | "dead";
export type Scenario = "calm" | "chaos";

export interface Job {
  id: number;
  name: string;
  state: JobState;
  attempts: number;
  worker: string | null;
}

export interface WorkerInfo {
  id: string;
  state: WorkerState;
  job: number | null;
  processed: number;
}

export interface Metrics {
  total: number;
  done: number;
  dead: number;
  retries: number;
  inFlight: number;
  errorRate: number; // current provider error probability
}

export interface Snapshot {
  t: number; // seconds since run start
  phase: string;
  jobs: Job[];
  workers: WorkerInfo[];
  metrics: Metrics;
  log: string[]; // new lines since last snapshot
  finished: boolean;
}
