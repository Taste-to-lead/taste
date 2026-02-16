import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { stagingAssets, stagingJobs } from "@shared/schema";
import { assessOutputMetadataIfAvailable, assessPromptForBannedTerms } from "./stagingQualityGate";
import { generateStagedImageWithProvider } from "./stagingProvider";
import type { StagingJobStatus } from "./stagingTypes";

const MIN_INTERVAL_MS = 8000;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type QueueJob = {
  jobId: string;
  inputImageUrl: string;
  prompt: string;
  negativePrompt: string;
  vibeId: string;
};

type JobState = {
  status: StagingJobStatus;
  updatedAt: number;
  error?: string;
  qualityFlags?: string[];
};

class StagingQueue {
  private readonly concurrency: number;
  private running = 0;
  private queue: QueueJob[] = [];
  private readonly jobState = new Map<string, JobState>();

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  enqueue(job: QueueJob): string {
    this.jobState.set(job.jobId, { status: "queued", updatedAt: Date.now() });
    this.queue.push(job);
    this.pump();
    return job.jobId;
  }

  getJobState(jobId: string): JobState | undefined {
    return this.jobState.get(jobId);
  }

  private pump(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.running++;
      this.process(next)
        .catch((error) => {
          console.error("[StagingQueue] process error:", error);
        })
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }

  private async updateJob(jobId: string, patch: {
    status?: StagingJobStatus;
    outputImageUrl?: string | null;
    qualityFlags?: string[] | null;
    error?: string | null;
    negativePromptUsed?: string;
  }): Promise<void> {
    const current = this.jobState.get(jobId);
    this.jobState.set(jobId, {
      status: patch.status || current?.status || "queued",
      updatedAt: Date.now(),
      error: patch.error || undefined,
      qualityFlags: patch.qualityFlags || undefined,
    });
    await db
      .update(stagingJobs)
      .set({
        ...patch,
        updatedAt: new Date(),
      } as any)
      .where(eq(stagingJobs.id, jobId));
  }

  private async process(job: QueueJob): Promise<void> {
    await this.updateJob(job.jobId, { status: "running", error: null });

    const promptFlags = assessPromptForBannedTerms(job.prompt, job.negativePrompt);
    if (promptFlags.length > 0) {
      await this.updateJob(job.jobId, {
        status: "flagged",
        qualityFlags: promptFlags,
        error: "Prompt failed staging quality gate.",
      });
      return;
    }

    let attempt = 0;
    let outputUrl: string | null = null;
    let providerMeta: Record<string, unknown> | undefined;
    let usedNegativePrompt = job.negativePrompt;
    let lastError = "";

    while (attempt < 2 && !outputUrl) {
      try {
        if (attempt === 1) {
          usedNegativePrompt = `${job.negativePrompt}, ABSOLUTELY NO ARCHITECTURAL CHANGES`;
          await this.updateJob(job.jobId, { negativePromptUsed: usedNegativePrompt });
        }

        const now = Date.now();
        const elapsed = now - lastRequestAt;
        if (elapsed < MIN_INTERVAL_MS) {
          await sleep(MIN_INTERVAL_MS - elapsed);
        }

        const generated = await generateStagedImageWithProvider({
          inputImageUrl: job.inputImageUrl,
          prompt: job.prompt,
          negativePrompt: usedNegativePrompt,
        });
        lastRequestAt = Date.now();
        outputUrl = generated.outputImageUrl;
        providerMeta = generated.providerMeta;
      } catch (error: any) {
        lastRequestAt = Date.now();
        lastError = error?.message || "generation_failed";
        attempt++;
      }
    }

    if (!outputUrl) {
      await this.updateJob(job.jobId, {
        status: "failed",
        error: lastError || "Staging generation failed after retry.",
      });
      return;
    }

    const outputFlags = assessOutputMetadataIfAvailable(providerMeta);
    if (outputFlags.length > 0) {
      await this.updateJob(job.jobId, {
        status: "flagged",
        qualityFlags: outputFlags,
        outputImageUrl: outputUrl,
        error: "Output flagged by staging quality gate.",
      });
      return;
    }

    await this.updateJob(job.jobId, {
      status: "done",
      outputImageUrl: outputUrl,
      qualityFlags: [],
      error: null,
    });

    const jobRow = await db.select().from(stagingJobs).where(eq(stagingJobs.id, job.jobId));
    const first = jobRow[0];
    if (first) {
      await db.insert(stagingAssets).values({
        id: crypto.randomUUID(),
        stagingJobId: job.jobId,
        vibeId: first.vibeId,
        imageUrl: outputUrl,
      } as any);
    }
  }
}

export const stagingQueue = new StagingQueue(1);
