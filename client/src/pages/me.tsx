import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

type BuyerProfile = {
  vector: Record<string, number>;
  topVibes: Array<{ vibe: string; score: number }>;
  rationale: Array<{ vibe: string; weight: number }>;
};

export default function MePage() {
  const buyerId = useMemo(() => localStorage.getItem("buyerId"), []);

  const { data, isLoading } = useQuery<BuyerProfile>({
    queryKey: ["/api/buyer/profile", buyerId],
    queryFn: async () => {
      const res = await fetch(`/api/buyer/profile?buyerId=${encodeURIComponent(buyerId || "")}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!buyerId,
  });

  if (!buyerId) return <div className="p-6">No buyer profile found. Visit /feed first.</div>;
  if (isLoading) return <div className="p-6">Loading profile...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">My Vibe Profile</h1>
      <Card className="p-4 space-y-2">
        {data?.topVibes?.map((v) => (
          <div key={v.vibe} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{v.vibe}</span>
              <span>{Math.round(v.score * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded">
              <div className="h-2 bg-primary rounded" style={{ width: `${Math.round(v.score * 100)}%` }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
