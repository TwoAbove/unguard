import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { Diagnostic, ProjectIndexNeed } from "../rules/types.ts";
import type { ProgramGroupConfig } from "../typecheck/program.ts";
import type { RulePolicySeverity } from "./types.ts";

export interface RuleSpec {
  id: string;
  severity: RulePolicySeverity;
}

export interface GroupTask {
  id: number;
  groupConfig: ProgramGroupConfig;
}

export interface WorkerRequest {
  taskId: number;
  groupConfig: ProgramGroupConfig;
  ruleSpecs: RuleSpec[];
  indexNeeds: ProjectIndexNeed[];
}

export type WorkerResponse =
  | { taskId: number; ok: true; diagnostics: Diagnostic[] }
  | { taskId: number; ok: false; error: string };

const WORKER_URL = new URL("./worker.js", import.meta.url);

/** False when running from source (no built `worker.js`); callers should fall back to serial. */
export function workersAvailable(): boolean {
  return existsSync(fileURLToPath(WORKER_URL));
}

export async function runGroupsInWorkers(
  tasks: GroupTask[],
  ruleSpecs: RuleSpec[],
  indexNeeds: ProjectIndexNeed[],
  concurrency: number,
): Promise<Diagnostic[][]> {
  if (tasks.length === 0) return [];

  // Heaviest groups first -> reduces tail latency when group count > worker count.
  const ordered = [...tasks].sort((a, b) => b.groupConfig.scanFiles.length - a.groupConfig.scanFiles.length);
  const workerCount = Math.min(concurrency, ordered.length);
  const workers: Worker[] = [];
  const results = new Array<Diagnostic[]>(tasks.length);

  for (let i = 0; i < tasks.length; i++) results[i] = [];

  let nextIndex = 0;
  let remaining = ordered.length;
  let firstError: Error | null = null;

  await new Promise<void>((resolve, reject) => {
    function finishOne(): void {
      remaining--;
      if (remaining === 0) {
        if (firstError !== null) reject(firstError);
        else resolve();
      }
    }

    function dispatchNext(worker: Worker): void {
      if (nextIndex >= ordered.length) return;
      const task = ordered[nextIndex];
      if (task === undefined) return;
      nextIndex++;
      const req: WorkerRequest = {
        taskId: task.id,
        groupConfig: task.groupConfig,
        ruleSpecs,
        indexNeeds,
      };
      worker.postMessage(req);
    }

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(fileURLToPath(WORKER_URL));
      workers.push(worker);

      worker.on("message", (response: WorkerResponse) => {
        if (response.ok) {
          results[response.taskId] = response.diagnostics;
        } else if (firstError === null) {
          firstError = new Error(`unguard worker error: ${response.error}`);
        }
        finishOne();
        dispatchNext(worker);
      });

      worker.on("error", (err: unknown) => {
        if (firstError === null) {
          firstError = err instanceof Error ? err : new Error(String(err));
        }
        finishOne();
      });

      worker.on("exit", (code) => {
        // Only an error if the worker died mid-task; the .finally() terminates after completion (code=1, benign).
        if (remaining > 0 && code !== 0 && firstError === null) {
          firstError = new Error(`unguard worker exited with code ${code}`);
          finishOne();
        }
      });

      dispatchNext(worker);
    }
  }).finally(() => {
    // @unguard no-swallowed-catch terminate is idempotent; rejection on already-exited worker is benign.
    for (const w of workers) w.terminate().catch(() => {});
  });

  return results;
}
