import crypto from "crypto";
import type { Express, Request } from "express";
import { eq } from "drizzle-orm";
import { Storage } from "@google-cloud/storage";
import { db } from "../../db";
import { stagingJobs } from "@shared/schema";
import { VIBES } from "@shared/tasteAlgorithm";
import { buildStagingPrompt } from "./promptBuilder";
import { stagingQueue } from "./stagingQueue";
import type { RoomType, VibeId } from "./stagingTypes";

type MultipartFile = {
  filename: string;
  mimeType: string;
  data: Buffer;
};

const ROOM_TYPES: RoomType[] = ["living", "bed", "kitchen", "bath", "office", "dining", "other"];
const VIBES_SET = new Set<string>(VIBES);

async function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; file: MultipartFile }> {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Missing multipart boundary");
  const boundary = boundaryMatch[1] || boundaryMatch[2];

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });

  const raw = Buffer.concat(chunks).toString("latin1");
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  const fields: Record<string, string> = {};
  let file: MultipartFile | null = null;

  for (const rawPart of parts) {
    const part = rawPart.startsWith("\r\n") ? rawPart.slice(2) : rawPart;
    const separatorIndex = part.indexOf("\r\n\r\n");
    if (separatorIndex < 0) continue;

    const headers = part.slice(0, separatorIndex);
    let body = part.slice(separatorIndex + 4);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);

    const nameMatch = headers.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileNameMatch = headers.match(/filename="([^"]*)"/i);

    if (fileNameMatch) {
      const mimeTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      file = {
        filename: fileNameMatch[1] || "upload",
        mimeType: (mimeTypeMatch?.[1] || "application/octet-stream").trim(),
        data: Buffer.from(body, "latin1"),
      };
    } else {
      fields[fieldName] = Buffer.from(body, "latin1").toString("utf8").trim();
    }
  }

  if (!file || !file.data || file.data.length === 0) {
    throw new Error("Image file is required");
  }

  return { fields, file };
}

function mimeToExt(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "bin";
}

async function uploadInputImage(file: MultipartFile, batchId: string): Promise<string> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    try {
      const bucketName = process.env.STAGING_BUCKET || "taste-to-lead-assets";
      const gcs = new Storage({
        keyFilename: credentialsPath,
        projectId: process.env.GCLOUD_PROJECT || "gen-lang-client-0912710356",
      });
      const ext = mimeToExt(file.mimeType);
      const filename = `staging-input-${batchId}-${Date.now()}.${ext}`;
      await gcs.bucket(bucketName).file(filename).save(file.data, {
        metadata: { contentType: file.mimeType },
        public: true,
      });
      return `https://storage.googleapis.com/${bucketName}/${filename}`;
    } catch (error) {
      console.warn("[StagingRoutes] GCS upload failed, falling back to data URL:", error);
    }
  }
  return `data:${file.mimeType};base64,${file.data.toString("base64")}`;
}

export function registerStagingRoutes(app: Express): void {
  app.post("/api/staging/stage", async (req, res) => {
    try {
      const { fields, file } = await parseMultipart(req);
      const roomType = fields.roomType as RoomType;
      if (!ROOM_TYPES.includes(roomType)) {
        return res.status(400).json({ message: "roomType is required and must be valid" });
      }

      const strictness = fields.strictness === "strict" ? "strict" : "normal";
      const batchId = crypto.randomUUID();
      const inputImageUrl = await uploadInputImage(file, batchId);
      const listingId = fields.listingId ? parseInt(fields.listingId, 10) : null;
      const agentId = fields.agentId || null;
      const buyerId = fields.buyerId || null;
      const roomNotes = fields.roomNotes || "";
      let selectedVibes: VibeId[] = [...VIBES];
      if (fields.vibes) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(fields.vibes);
        } catch {
          return res.status(400).json({ message: "vibes must be valid JSON array" });
        }
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ message: "vibes must be an array" });
        }
        if (!parsed.every((v) => typeof v === "string" && VIBES_SET.has(v))) {
          return res.status(400).json({ message: "vibes contains invalid vibe id(s)" });
        }
        selectedVibes = parsed as VibeId[];
      }

      const jobs: Array<{ jobId: string; vibeId: VibeId; status: string }> = [];

      for (const vibeId of selectedVibes) {
        const jobId = crypto.randomUUID();
        const built = buildStagingPrompt({
          vibeId,
          roomType,
          optionalRoomNotes: roomNotes,
          strictness,
        });

        await db.insert(stagingJobs).values({
          id: jobId,
          batchId,
          agentId,
          buyerId,
          listingId,
          vibeId,
          roomType,
          inputImageUrl,
          status: "queued",
          outputImageUrl: null,
          promptUsed: built.prompt,
          negativePromptUsed: built.negativePrompt,
          qualityFlags: [],
          error: null,
        } as any);

        stagingQueue.enqueue({
          jobId,
          inputImageUrl,
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          vibeId,
        });

        jobs.push({ jobId, vibeId, status: "queued" });
      }

      res.status(202).json({ batchId, jobs });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to start staging batch" });
    }
  });

  app.get("/api/staging/batch/:batchId", async (req, res) => {
    try {
      const rows = await db.select().from(stagingJobs).where(eq(stagingJobs.batchId, req.params.batchId));
      const jobs = rows.map((job) => ({
        jobId: job.id,
        vibeId: job.vibeId,
        status: job.status,
        outputImageUrl: job.outputImageUrl,
        qualityFlags: job.qualityFlags || [],
        error: job.error,
      }));
      res.json({ batchId: req.params.batchId, jobs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/staging/job/:jobId", async (req, res) => {
    try {
      const rows = await db.select().from(stagingJobs).where(eq(stagingJobs.id, req.params.jobId));
      const job = rows[0];
      if (!job) return res.status(404).json({ message: "Job not found" });
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
