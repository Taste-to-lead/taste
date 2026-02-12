import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

type AgentLead = {
  id: number;
  buyerId: string;
  listingId: number;
  address: string | null;
  matchScore: number;
  topBuyerVibes: Array<{ vibe: string; score: number }>;
  topListingVibes: Array<{ vibe: string; score: number }>;
  talkTrack: string;
  avoidList: string[];
  createdAt: string;
};

export default function AgentLeadsPage() {
  const { user } = useAuth();
  const agentId = useMemo(() => String(user?.id || ""), [user?.id]);

  const { data = [], isLoading } = useQuery<AgentLead[]>({
    queryKey: ["/api/agent/leads", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agent/leads?agentId=${encodeURIComponent(agentId)}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!agentId,
  });

  if (isLoading) return <div className="p-6">Loading leads...</div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Agent Leads</h1>
      {data.map((lead) => {
        const topBuyer = lead.topBuyerVibes?.[0]?.vibe || "Unknown";
        const topListing = lead.topListingVibes?.[0]?.vibe || "Unknown";
        return (
          <Card key={lead.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{lead.address || `Listing #${lead.listingId}`}</h2>
              <Badge>{lead.matchScore}%</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Buyer vibe: {topBuyer} · Listing vibe: {topListing}</p>
            <p className="text-sm">{lead.talkTrack}</p>
            <p className="text-xs text-muted-foreground">Avoid: {(lead.avoidList || []).join(", ") || "None"}</p>
          </Card>
        );
      })}
    </div>
  );
}
