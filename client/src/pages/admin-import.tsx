import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { Upload, Globe, Loader2, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type ImportJob = {
  id: string;
  agentId: string;
  sourceType: "url" | "csv";
  source: string;
  status: "queued" | "running" | "done" | "failed";
  total: number;
  processed: number;
  succeeded: number;
  failedCount: number;
  error: string | null;
};

export default function AdminImport() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const urlImportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portfolio/import/url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: String(user?.id || ""), url }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ jobId: string }>;
    },
    onSuccess: (data) => setJobId(data.jobId),
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const csvImportMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("CSV is required");
      const fd = new FormData();
      fd.append("agentId", String(user?.id || ""));
      fd.append("file", file);
      const res = await fetch("/api/portfolio/import/csv", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ jobId: string }>;
    },
    onSuccess: (data) => setJobId(data.jobId),
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: job } = useQuery<ImportJob>({
    queryKey: ["/api/portfolio/import/job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("jobId required");
      const res = await fetch(`/api/portfolio/import/job/${jobId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.status === "queued" || d.status === "running") ? 1500 : false;
    },
  });

  const progress = useMemo(() => {
    if (!job || job.total <= 0) return 0;
    return Math.round((job.processed / job.total) * 100);
  }, [job]);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!user?.isAdmin) return <Redirect to="/agent" />;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Portfolio Import</h1>

      <Card className="p-4 space-y-3">
        <p className="font-medium">Import from URL</p>
        <Input
          placeholder="https://example-brokerage.com/listings"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={() => urlImportMutation.mutate()} disabled={!url || urlImportMutation.isPending}>
          {urlImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
          Start URL Import
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-medium">CSV Fallback</p>
        <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="text-xs text-muted-foreground">
          Template headers: <code>address,price,beds,baths,sqft,description,photoUrls,sourceUrl,title</code>
        </div>
        <Button onClick={() => csvImportMutation.mutate()} disabled={!file || csvImportMutation.isPending}>
          {csvImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          Upload CSV
        </Button>
      </Card>

      {job && (
        <Card className="p-4 space-y-2">
          <p className="font-medium">Job Status: {job.status}</p>
          <p className="text-sm text-muted-foreground">
            Processed {job.processed}/{job.total} | Succeeded {job.succeeded} | Failed {job.failedCount}
          </p>
          <div className="w-full h-2 bg-muted rounded">
            <div className="h-2 bg-primary rounded" style={{ width: `${progress}%` }} />
          </div>
          {job.status === "failed" && (
            <p className="text-sm text-destructive">
              {job.error || "Couldn’t auto-detect listings from that page. Upload the CSV template instead — we’ll still vibe-tag everything."}
            </p>
          )}
          {job.status === "done" && (
            <div className="space-y-2">
              <p className="text-sm text-emerald-600">Portfolio imported. Vibe Portfolio link ready.</p>
              <Link href={`/portfolio/${job.agentId}`} className="inline-flex items-center text-sm text-primary hover:underline">
                <Link2 className="w-3 h-3 mr-1" />
                Open Vibe Portfolio
              </Link>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
