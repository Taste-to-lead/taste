import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Building2, Trash2, Zap, Crown, Shield, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Redirect } from "wouter";
import StagingLab from "./StagingLab";

type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  subscriptionTier: string;
  isAdmin: boolean;
  organizationId: number | null;
};

type AdminListing = {
  id: number;
  title: string;
  price: number;
  location: string;
  vibe: string;
  vibeTag: string;
  status: string;
  agentId: string;
  organizationId: number | null;
};

type TabId = "agents" | "listings" | "staging";

function StatCard({ icon: Icon, label, value }: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5 backdrop-blur-xl bg-card/80 border-card-border" data-testid={`admin-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold" data-testid={`admin-stat-value-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function AgentsTab() {
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const premiumCount = users.filter(u => u.subscriptionTier === "premium").length;
  const freeCount = users.filter(u => u.subscriptionTier === "free").length;
  const adminCount = users.filter(u => u.isAdmin).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Agents" value={String(users.length)} />
        <StatCard icon={Crown} label="Premium" value={String(premiumCount)} />
        <StatCard icon={Users} label="Free" value={String(freeCount)} />
        <StatCard icon={Shield} label="Admins" value={String(adminCount)} />
      </div>

      <Card className="overflow-hidden border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-agents">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50" data-testid={`row-agent-${u.id}`}>
                  <td className="px-4 py-3 text-muted-foreground">{u.id}</td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.name}
                      {u.isAdmin && <Badge variant="outline" className="text-xs"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.subscriptionTier === "premium" ? (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                        <Crown className="w-3 h-3 mr-1" />Premium
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Free</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ListingsTab() {
  const { toast } = useToast();
  const { data: listings = [], isLoading } = useQuery<AdminListing[]>({
    queryKey: ["/api/admin/listings"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/admin/listing/${id}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listings"] });
      toast({ title: "Listing deleted", description: "The listing has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCount = listings.filter(l => l.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Building2} label="Total Listings" value={String(listings.length)} />
        <StatCard icon={Building2} label="Active" value={String(activeCount)} />
        <StatCard icon={Building2} label="Inactive" value={String(listings.length - activeCount)} />
      </div>

      <Card className="overflow-hidden border-card-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-listings">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vibe</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-border/50" data-testid={`row-listing-${l.id}`}>
                  <td className="px-4 py-3 text-muted-foreground">{l.id}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{l.title}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{l.location}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{l.vibeTag || l.vibe}</Badge>
                  </td>
                  <td className="px-4 py-3">${l.price?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={l.status === "active" ? "default" : "secondary"} className="text-xs">{l.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(l.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-listing-${l.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StagingTab() {
  return <StagingLab />;
}

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const initialTab: TabId = (() => {
    if (typeof window === "undefined") return "agents";
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "agents" || tab === "listings" || tab === "staging") return tab;
    return "agents";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Redirect to="/agent" />;
  }

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "agents", label: "Agents", icon: Users },
    { id: "listings", label: "Listings", icon: Building2 },
    { id: "staging", label: "AI Staging", icon: Wand2 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-admin-title">God Mode</h1>
          <p className="text-sm text-muted-foreground">Platform administration</p>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
            className="gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "agents" && <AgentsTab />}
      {activeTab === "listings" && <ListingsTab />}
      {activeTab === "staging" && <StagingTab />}
    </div>
  );
}
