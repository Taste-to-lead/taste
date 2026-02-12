import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeedItem = {
  id: number;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  heroPhotoUrl: string | null;
  topVibe: string;
  vibeTags: string[];
};

type FeedResponse = {
  page: number;
  pageSize: number;
  items: FeedItem[];
};

type SwipeResult = {
  matchScore: number;
  buyerTopVibes: Array<{ vibe: string; score: number }>;
  listingTopVibes: Array<{ vibe: string; score: number }>;
  leadCreated: boolean;
  hotLead: boolean;
};

export default function FeedPage() {
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [shownAt, setShownAt] = useState<number>(Date.now());
  const [lastSwipe, setLastSwipe] = useState<SwipeResult | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("buyerId");
    if (existing) {
      setBuyerId(existing);
      return;
    }
    fetch("/api/buyer/init", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        localStorage.setItem("buyerId", data.buyerId);
        setBuyerId(data.buyerId);
      });
  }, []);

  const { data } = useQuery<FeedResponse>({
    queryKey: ["/api/listings/feed"],
    queryFn: async () => {
      const res = await fetch("/api/listings/feed?page=1&pageSize=50", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const items = data?.items || [];
  const current = items[index] || null;

  const swipeMutation = useMutation({
    mutationFn: async (action: "like" | "nope" | "save" | "skip") => {
      if (!buyerId || !current) throw new Error("Missing buyer or listing");
      const dwellMs = Math.max(0, Date.now() - shownAt);
      const res = await fetch("/api/buyer/swipe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          listingId: current.id,
          action,
          dwellMs,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SwipeResult>;
    },
    onSuccess: (data) => {
      setLastSwipe(data);
      setIndex((prev) => prev + 1);
      setShownAt(Date.now());
    },
  });

  const done = useMemo(() => index >= items.length, [index, items.length]);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Discovery Feed</h1>
      {!buyerId && <p>Initializing buyer profile...</p>}
      {done && <p>No more listings in this feed.</p>}

      {current && (
        <Card className="overflow-hidden">
          <img
            src={current.heroPhotoUrl || "/images/property-1.png"}
            alt={current.address}
            className="w-full h-64 object-cover"
          />
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{current.address}</h2>
              <Badge>{current.topVibe}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              ${Number(current.price || 0).toLocaleString()} · {current.beds} bd · {current.baths} ba · {current.sqft} sqft
            </p>
            <div className="flex flex-wrap gap-1">
              {current.vibeTags?.map((tag) => (
                <Badge variant="outline" key={tag}>{tag}</Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button onClick={() => swipeMutation.mutate("like")} disabled={swipeMutation.isPending}>Like</Button>
              <Button variant="secondary" onClick={() => swipeMutation.mutate("nope")} disabled={swipeMutation.isPending}>Nope</Button>
              <Button onClick={() => swipeMutation.mutate("save")} disabled={swipeMutation.isPending}>Save</Button>
              <Button variant="outline" onClick={() => swipeMutation.mutate("skip")} disabled={swipeMutation.isPending}>Skip</Button>
            </div>
          </div>
        </Card>
      )}

      {lastSwipe && (
        <Card className="p-3">
          <p className="text-sm">
            Match Score: <strong>{lastSwipe.matchScore}</strong>{lastSwipe.hotLead ? " (Hot lead)" : ""}
          </p>
        </Card>
      )}
    </div>
  );
}
