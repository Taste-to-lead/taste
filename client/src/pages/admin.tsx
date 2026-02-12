import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Building2, Trash2, Zap, Crown, Shield, Upload, Wand2, RefreshCw, ImageIcon, Check, Download, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Redirect } from "wouter";

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

const VIBE_ARCHETYPES = [
  { name: "Monarch", color: "from-amber-500 to-yellow-600", icon: "crown", desc: "Regal, opulent spaces with rich textures and grand scale" },
  { name: "Industrialist", color: "from-stone-500 to-neutral-600", icon: "factory", desc: "Raw materials, exposed elements, warehouse soul" },
  { name: "Purist", color: "from-slate-400 to-zinc-500", icon: "minimize", desc: "Minimalist, clean lines, monochromatic discipline" },
  { name: "Naturalist", color: "from-emerald-400 to-green-500", icon: "leaf", desc: "Organic, biophilic, earth-grounded sanctuaries" },
  { name: "Futurist", color: "from-cyan-400 to-blue-500", icon: "zap", desc: "Cutting-edge tech, sleek smart surfaces" },
  { name: "Curator", color: "from-violet-400 to-purple-500", icon: "palette", desc: "Eclectic art, bold statement pieces, gallery walls" },
  { name: "Nomad", color: "from-orange-400 to-red-500", icon: "compass", desc: "Global influences, layered textiles, warm tones" },
  { name: "Classicist", color: "from-rose-400 to-pink-500", icon: "landmark", desc: "Traditional elegance, timeless heritage design" },
];

type StagingCard = {
  name: string;
  color: string;
  desc: string;
  imageUrl: string;
  hook: string;
  selected: boolean;
};

function StagingTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<StagingCard[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const selectedCount = generatedCards.filter(c => c.selected).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setGeneratedCards([]);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast({ title: "Upload Required", description: "Please upload an empty room photo first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);

    try {
      const hookRes = await apiRequest("POST", "/api/admin/staging-hooks", { roomDescription: "empty room for virtual staging" });
      const hookData = await hookRes.json();
      const hooksMap: Record<string, string> = {};
      if (hookData.hooks) {
        hookData.hooks.forEach((h: { archetype: string; hook: string }) => {
          hooksMap[h.archetype] = h.hook;
        });
      }

      const cards: StagingCard[] = VIBE_ARCHETYPES.map((v) => ({
        name: v.name,
        color: v.color,
        desc: v.desc,
        imageUrl: uploadedImage!,
        hook: hooksMap[v.name] || `Experience this space reimagined through the ${v.name} lens.`,
        selected: false,
      }));
      setGeneratedCards(cards);
      toast({ title: "Full Spectrum Generated", description: "8 archetype variations with selling hooks ready. Select your favorites." });
    } catch {
      const cards: StagingCard[] = VIBE_ARCHETYPES.map((v) => ({
        name: v.name,
        color: v.color,
        desc: v.desc,
        imageUrl: uploadedImage!,
        hook: `Experience this space reimagined through the ${v.name} lens.`,
        selected: false,
      }));
      setGeneratedCards(cards);
      toast({ title: "8 Realities Generated", description: "Selling hooks unavailable, using defaults." });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    setGeneratedCards(prev => prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c));
  };

  const handleSelectAll = () => {
    const allSelected = generatedCards.every(c => c.selected);
    setGeneratedCards(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const handleRegenerate = async (index: number) => {
    const card = generatedCards[index];
    if (!uploadedImage) return;

    setRegeneratingIndex(index);
    toast({ title: "Step 1/2: Analyzing Room", description: `Using Gemini AI to analyze ${card.name} vibe...` });

    try {
      // Step 1: Analyze the room and get the staging prompt
      const analyzeRes = await apiRequest("POST", "/api/admin/staging-analyze", {
        imageData: uploadedImage,
        targetVibe: card.name,
      });
      const analyzeData = await analyzeRes.json();
      
      if (!analyzeData.prompt) {
        throw new Error("No prompt generated");
      }

      // Update the hook with the generated prompt
      setGeneratedCards(prev => prev.map((c, i) =>
        i === index ? { ...c, hook: analyzeData.prompt } : c
      ));

      // Step 2: Generate the staged image using Vertex AI Imagen
      toast({ title: "Step 2/2: Generating Image", description: `Creating ${card.name} staged room with Vertex AI Imagen 3...` });

      const generateRes = await apiRequest("POST", "/api/admin/staging-generate", {
        prompt: analyzeData.prompt,
        vibe: card.name,
      });
      const generateData = await generateRes.json();

      if (generateData.success && generateData.imageUrl) {
        // Update the card with the new AI-generated image
        setGeneratedCards(prev => prev.map((c, i) =>
          i === index ? { ...c, imageUrl: generateData.imageUrl } : c
        ));
        toast({ 
          title: `${card.name} Staging Complete!`, 
          description: "AI-generated room image ready. Powered by Google Vertex AI Imagen 3." 
        });
      } else {
        throw new Error(generateData.message || "Image generation failed");
      }
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast({ 
        title: "Generation Failed", 
        description: error.message || "Could not generate staged image. Check console for details.", 
        variant: "destructive" 
      });
    } finally {
      setRegeneratingIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-card-border space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Full Spectrum Virtual Staging</h3>
            <p className="text-xs text-muted-foreground">Upload a room photo to generate all 8 archetype variations with AI selling hooks</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-staging-upload"
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-upload-room"
          >
            <Upload className="w-4 h-4" />
            {uploadedImage ? "Change Photo" : "Choose Photo"}
          </Button>
          <Button
            className="gap-2"
            onClick={handleGenerate}
            disabled={!uploadedImage || isGenerating}
            data-testid="button-generate-realities"
          >
            <Wand2 className="w-4 h-4" />
            {isGenerating ? "Generating All 8..." : "Generate 8 Realities"}
          </Button>
        </div>

        {uploadedImage && !generatedCards.length && (
          <div className="rounded-md overflow-hidden border border-border max-w-xs">
            <img src={uploadedImage} alt="Uploaded room" className="w-full h-auto" data-testid="img-uploaded-room" />
          </div>
        )}
      </Card>

      {generatedCards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg" data-testid="text-staging-results-title">8 Archetype Realities</h3>
              {selectedCount > 0 && (
                <Badge variant="secondary" className="text-xs">{selectedCount} selected</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                <Check className="w-3 h-3" />
                {generatedCards.every(c => c.selected) ? "Deselect All" : "Select All"}
              </Button>
              {selectedCount > 0 && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => toast({ title: "Export Ready", description: `${selectedCount} staging variation(s) prepared. Connect storage to enable downloads.` })}
                  data-testid="button-download-selected"
                >
                  <Download className="w-3 h-3" />
                  Export ({selectedCount})
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="grid-staging-results">
            {generatedCards.map((card, i) => (
              <Card
                key={card.name}
                className={`overflow-visible border-card-border transition-all duration-200 ${card.selected ? "ring-2 ring-primary" : ""}`}
                data-testid={`card-staging-${card.name.toLowerCase()}`}
              >
                <div className="aspect-[4/3] relative overflow-hidden rounded-t-md">
                  <img src={card.imageUrl} alt={`${card.name} staging`} className="w-full h-full object-cover" />
                  
                  {/* Loading overlay when regenerating */}
                  {regeneratingIndex === i && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                        <p className="text-white text-sm font-medium">Generating with AI...</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <Badge className={`bg-gradient-to-r ${card.color} text-white border-0 text-xs`}>
                      The {card.name} Version
                    </Badge>
                  </div>
                  <button
                    className={`absolute top-3 right-3 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      card.selected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-black/40 border-white/50 hover:border-white"
                    }`}
                    onClick={() => toggleSelect(i)}
                    data-testid={`checkbox-select-${card.name.toLowerCase()}`}
                  >
                    {card.selected && <Check className="w-3 h-3" />}
                  </button>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white/70 text-[11px]">{card.desc}</p>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="min-h-[3rem]">
                    <p className="text-xs text-muted-foreground italic leading-relaxed" data-testid={`text-hook-${card.name.toLowerCase()}`}>
                      "{card.hook}"
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleRegenerate(i)}
                    disabled={regeneratingIndex === i}
                    data-testid={`button-regenerate-${card.name.toLowerCase()}`}
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingIndex === i ? 'animate-spin' : ''}`} />
                    {regeneratingIndex === i ? 'Generating...' : 'Regenerate'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("agents");

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
