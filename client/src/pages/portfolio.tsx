import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PortfolioListing = {
  id: number;
  title: string;
  location: string;
  price: number;
  images: string[];
  primaryVibeBadge: string;
  topVibes: Array<{ vibe: string; score: number }>;
};

export default function PortfolioPage() {
  const [, params] = useRoute("/portfolio/:agentId");
  const agentId = params?.agentId || "";

  const { data = [], isLoading, error } = useQuery<PortfolioListing[]>({
    queryKey: ["/api/portfolio", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/${agentId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!agentId,
  });

  if (isLoading) return <div className="p-6">Loading portfolio...</div>;
  if (error) return <div className="p-6 text-destructive">Failed to load portfolio.</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Vibe Portfolio</h1>
      <p className="text-sm text-muted-foreground">Agent {agentId}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <img src={item.images?.[0] || "/images/property-1.png"} alt={item.title} className="w-full h-44 object-cover" />
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold truncate">{item.title}</h3>
                <Badge>{item.primaryVibeBadge}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{item.location}</p>
              <p className="text-sm font-medium">${Number(item.price || 0).toLocaleString()}</p>
              <div className="flex flex-wrap gap-1">
                {item.topVibes?.slice(0, 3).map((v) => (
                  <Badge key={v.vibe} variant="outline" className="text-xs">{v.vibe}</Badge>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
