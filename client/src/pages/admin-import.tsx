import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { Upload, Globe, Loader2, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type ImportSource = "local" | "url";
type ImportType = "listings" | "sold" | "rentals" | "mixed";
type UrlType = "single_listing" | "agent_portfolio" | "brokerage_page" | "feed_endpoint";
type UrlParserStrategy = "auto" | "agent_site_crawl" | "generic_page";
type UrlImportMode = "auto" | "single" | "portfolio";
type LocalExtension = "csv" | "xlsx" | "json" | "xml" | "zip" | "pdf" | "jpg" | "png";

const LOCAL_EXTENSIONS: LocalExtension[] = ["csv", "xlsx", "json", "xml", "zip", "pdf", "jpg", "png"];

type ImportJob = {
  id: string;
  agentId: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  stage: string;
  counts?: Record<string, number>;
  reasonCode?: string;
  triedStrategies?: string[];
  debug?: {
    httpStatus?: number;
    contentType?: string;
    finalUrl?: string;
  };
  error: string | null;
};

export default function AdminImport() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<ImportSource>("local");
  const [importType, setImportType] = useState<ImportType>("listings");
  const [localExtensions, setLocalExtensions] = useState<LocalExtension[]>([...LOCAL_EXTENSIONS]);
  const [urlType, setUrlType] = useState<UrlType>("single_listing");
  const [urlParserStrategy, setUrlParserStrategy] = useState<UrlParserStrategy>("auto");
  const [urlImportMode, setUrlImportMode] = useState<UrlImportMode>("auto");

  const urlImportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portfolio/import/url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: String(user?.id || ""),
          url,
          importSource,
          importType,
          localExtensions,
          urlType,
          urlParserStrategy,
          urlImportMode,
        }),
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
      fd.append("importSource", importSource);
      fd.append("importType", importType);
      fd.append("localExtensions", JSON.stringify(localExtensions));
      fd.append("urlType", urlType);
      fd.append("urlParserStrategy", urlParserStrategy);
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
    queryKey: ["/api/import/status", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("jobId required");
      const res = await fetch(`/api/import/status?jobId=${encodeURIComponent(jobId)}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.status === "queued" || d.status === "running") ? 2000 : false;
    },
  });

  const progress = useMemo(() => {
    if (!job) return 0;
    return Math.max(0, Math.min(100, job.progress || 0));
  }, [job]);

  const summaryText = useMemo(() => {
    const detail = importSource === "local" ? localExtensions.join(", ") : `${urlType}, ${urlParserStrategy}`;
    return `Mode: ${importSource} • Type: ${importType} • Extensions/URL: ${detail || "none"}`;
  }, [importSource, importType, localExtensions, urlType, urlParserStrategy]);

  const toggleLocalExtension = (ext: LocalExtension) => {
    setLocalExtensions((prev) => (prev.includes(ext) ? prev.filter((v) => v !== ext) : [...prev, ext]));
  };

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!user?.isAdmin) return <Redirect to="/agent" />;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Portfolio Import</h1>

      <Card className="p-4 space-y-3">
        <p className="font-medium">Import Options</p>
        <div className="space-y-2">
          <p className="text-sm">Import source</p>
          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="importSource"
                value="local"
                checked={importSource === "local"}
                onChange={() => setImportSource("local")}
              />
              <span>local</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="importSource"
                value="url"
                checked={importSource === "url"}
                onChange={() => setImportSource("url")}
              />
              <span>url</span>
            </label>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm">Import type</label>
          <select
            value={importType}
            onChange={(e) => setImportType(e.target.value as ImportType)}
            className="h-10 rounded-md border px-3 bg-background w-full"
          >
            <option value="listings">listings</option>
            <option value="sold">sold</option>
            <option value="rentals">rentals</option>
            <option value="mixed">mixed</option>
          </select>
        </div>

        {importSource === "local" ? (
          <>
            <div className="space-y-2">
              <p className="text-sm">Local extensions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {LOCAL_EXTENSIONS.map((ext) => (
                  <label key={ext} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localExtensions.includes(ext)}
                      onChange={() => toggleLocalExtension(ext)}
                    />
                    <span>{ext}</span>
                  </label>
                ))}
              </div>
            </div>
            <Input
              type="file"
              accept=".csv,.xlsx,.json,.xml,.zip,.pdf,.jpg,.jpeg,.png,text/csv,application/json,application/xml"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="text-xs text-muted-foreground">
              Template headers (CSV): <code>address,price,beds,baths,sqft,description,photoUrls,sourceUrl,title</code>
            </div>
            <Button onClick={() => csvImportMutation.mutate()} disabled={!file || csvImportMutation.isPending}>
              {csvImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Start Local Import
            </Button>
          </>
        ) : (
          <>
            <Input
              placeholder="https://example-brokerage.com/listings"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div className="space-y-1">
              <label className="text-sm">URL Import Mode</label>
              <select
                value={urlImportMode}
                onChange={(e) => setUrlImportMode(e.target.value as UrlImportMode)}
                className="h-10 rounded-md border px-3 bg-background w-full"
              >
                <option value="auto">auto</option>
                <option value="single">single</option>
                <option value="portfolio">portfolio</option>
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm">URL type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {(["single_listing", "agent_portfolio", "brokerage_page", "feed_endpoint"] as const).map((value) => (
                  <label key={value} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="urlType"
                      value={value}
                      checked={urlType === value}
                      onChange={() => setUrlType(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">URL parser strategy</label>
              <select
                value={urlParserStrategy}
                onChange={(e) => setUrlParserStrategy(e.target.value as UrlParserStrategy)}
                className="h-10 rounded-md border px-3 bg-background w-full"
              >
                <option value="auto">auto</option>
                <option value="agent_site_crawl">agent_site_crawl</option>
                <option value="generic_page">generic_page</option>
              </select>
            </div>
            <Button onClick={() => urlImportMutation.mutate()} disabled={!url || urlImportMutation.isPending}>
              {urlImportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
              Start URL Import
            </Button>
          </>
        )}
        <div className="text-xs text-muted-foreground">{summaryText}</div>
      </Card>

      {job && (
        <Card className="p-4 space-y-2">
          <p className="font-medium">Job Status: {job.status}</p>
          <p className="text-sm text-muted-foreground">
            Progress {progress}%{job.stage ? ` • Stage: ${job.stage}` : ""}
          </p>
          {job.counts && (
            <p className="text-xs text-muted-foreground">
              Processed {job.counts.processed ?? 0}/{job.counts.discovered ?? job.counts.total ?? 0}
            </p>
          )}
          <div className="w-full h-2 bg-muted rounded">
            <div className="h-2 bg-primary rounded" style={{ width: `${progress}%` }} />
          </div>
          {job.status === "failed" && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{job.error || "Couldn't import from that URL."}</p>
              {job.reasonCode && <p className="text-xs text-destructive/90">Reason: {job.reasonCode}</p>}
              {job.triedStrategies && job.triedStrategies.length > 0 && (
                <p className="text-xs text-destructive/90">Tried: {job.triedStrategies.join(" -> ")}</p>
              )}
            </div>
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
