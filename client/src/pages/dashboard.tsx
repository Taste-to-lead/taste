import { useQuery } from "@tanstack/react-query";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Property } from "@shared/schema";

function StatCard({ icon: Icon, label, value, subtext }: {
  icon: typeof Building2;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <Card className="relative overflow-visible p-5 backdrop-blur-xl bg-card/80 border-card-border" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const totalListings = properties?.length ?? 0;
  const activeListings = properties?.filter(p => p.status === "active").length ?? 0;
  const totalValue = properties?.reduce((sum, p) => sum + p.price, 0) ?? 0;

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back to your command center</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-20 bg-muted rounded-md" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back to your command center</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Listings"
          value={totalListings.toString()}
          subtext={`${activeListings} active`}
        />
        <StatCard
          icon={Users}
          label="Active Leads"
          value="24"
          subtext="+3 this week"
        />
        <StatCard
          icon={DollarSign}
          label="Total Value"
          value={formatCurrency(totalValue)}
          subtext="Across all listings"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion Rate"
          value="12.5%"
          subtext="+2.1% from last month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 backdrop-blur-xl bg-card/80 border-card-border">
          <h3 className="font-semibold mb-4" data-testid="text-recent-activity">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: "New lead on", property: "Skyline Penthouse", time: "2 hours ago" },
              { action: "Price updated for", property: "Mediterranean Villa", time: "5 hours ago" },
              { action: "New inquiry on", property: "Urban Loft", time: "1 day ago" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 flex-wrap py-2 border-b border-border last:border-0">
                <p className="text-sm">
                  <span className="text-muted-foreground">{item.action}</span>{" "}
                  <span className="font-medium">{item.property}</span>
                </p>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 backdrop-blur-xl bg-card/80 border-card-border">
          <h3 className="font-semibold mb-4" data-testid="text-quick-stats">Performance</h3>
          <div className="space-y-4">
            {[
              { label: "Profile Views", value: 1842, max: 2500 },
              { label: "Lead Responses", value: 18, max: 30 },
              { label: "Listings Viewed", value: 432, max: 500 },
            ].map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(item.value / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
