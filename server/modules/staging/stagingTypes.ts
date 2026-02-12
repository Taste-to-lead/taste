import type { Vibe } from "@shared/tasteAlgorithm";

export type VibeId = Vibe;

export type RoomType =
  | "living"
  | "bed"
  | "kitchen"
  | "bath"
  | "office"
  | "dining"
  | "other";

export type StagingJobStatus = "queued" | "running" | "done" | "failed" | "flagged";

export type StagingJobRecord = {
  id: string;
  batchId: string;
  agentId?: string | null;
  buyerId?: string | null;
  listingId?: number | null;
  vibeId: VibeId;
  roomType: RoomType;
  inputImageUrl: string;
  status: StagingJobStatus;
  outputImageUrl?: string | null;
  promptUsed: string;
  negativePromptUsed: string;
  qualityFlags?: string[] | null;
  error?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};
