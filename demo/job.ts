interface Job {
  id: string;
  attempts: number;
  payload: string;
}

type Payload = { kind: string; data: string };

export function processJob(job: Job) {
  const attempts = job.attempts ?? 1;

  if (typeof job.id !== "string") {
    throw new Error("job is missing an id");
  }

  try {
    const payload = JSON.parse(job.payload) as Payload;
    return { id: job.id, attempts, payload };
  } catch {
    return null;
  }
}
