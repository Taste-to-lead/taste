import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BatchJob = {
  jobId: string;
  vibeId: string;
  status: "queued" | "running" | "done" | "failed" | "flagged";
  outputImageUrl?: string | null;
  qualityFlags?: string[];
  error?: string | null;
};

type BatchResponse = {
  batchId: string;
  jobs: BatchJob[];
};

const ROOM_TYPES = ["living", "bed", "kitchen", "bath", "office", "dining", "other"] as const;

export default function StagingLab() {
  const [file, setFile] = useState<File | null>(null);
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>("living");
  const [strictness, setStrictness] = useState<"normal" | "strict">("normal");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BatchJob[]>([]);

  const stageMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please upload an image");
      const fd = new FormData();
      fd.append("image", file);
      fd.append("roomType", roomType);
      fd.append("strictness", strictness);
      const res = await fetch("/api/staging/stage", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BatchResponse>;
    },
    onSuccess: (data) => {
      setBatchId(data.batchId);
      setJobs(data.jobs);
    },
  });

  const { data: batchData } = useQuery<BatchResponse>({
    queryKey: ["/api/staging/batch", batchId],
    queryFn: async () => {
      const res = await fetch(`/api/staging/batch/${batchId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      const current = query.state.data;
      if (!current) return 2000;
      const unfinished = current.jobs.some((j) => j.status === "queued" || j.status === "running");
      return unfinished ? 2000 : false;
    },
  });

  const visibleJobs = useMemo(() => batchData?.jobs || jobs, [batchData, jobs]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Staging Lab</h1>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value as (typeof ROOM_TYPES)[number])}
            className="h-10 rounded-md border px-3 bg-background"
          >
            {ROOM_TYPES.map((rt) => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
          <select
            value={strictness}
            onChange={(e) => setStrictness(e.target.value as "normal" | "strict")}
            className="h-10 rounded-md border px-3 bg-background"
          >
            <option value="normal">Strictness: normal</option>
            <option value="strict">Strictness: strict</option>
          </select>
        </div>

        <Button onClick={() => stageMutation.mutate()} disabled={!file || stageMutation.isPending}>
          Generate 8 Vibes
        </Button>
      </Card>

      {batchId && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Batch ID: {batchId}</p>
        </Card>
      )}

      {visibleJobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleJobs.map((job) => (
            <Card key={job.jobId} className="overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{job.vibeId}</p>
                  <p className="text-xs uppercase text-muted-foreground">{job.status}</p>
                </div>
                {job.outputImageUrl ? (
                  <img src={job.outputImageUrl} alt={`${job.vibeId} staging`} className="w-full h-40 object-cover rounded" />
                ) : (
                  <div className="w-full h-40 bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">
                    {job.status}
                  </div>
                )}
                {job.qualityFlags && job.qualityFlags.length > 0 && (
                  <div className="text-xs text-amber-600">
                    Flags: {job.qualityFlags.join(", ")}
                  </div>
                )}
                {job.error && <div className="text-xs text-destructive">{job.error}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
