import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, useMotionValue, useTransform, animate, PanInfo, AnimatePresence } from "framer-motion";
import { MapPin, Bed, Bath, Ruler, ArrowLeft, Heart, X as XIcon, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Property } from "@shared/schema";

type OnboardingData = {
  location: string;
  budgetMin: number;
  budgetMax: number;
  bedrooms: string;
  vibe: string;
};

function OnboardingWizard({ onComplete }: { onComplete: (data: OnboardingData) => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    location: "",
    budgetMin: 100000,
    budgetMax: 10000000,
    bedrooms: "2",
    vibe: "modern",
  });

  const locations = ["Manhattan, NY", "Brooklyn, NY", "Miami Beach, FL", "Beverly Hills, CA", "Austin, TX", "Chicago, IL"];
  const [locationSearch, setLocationSearch] = useState("");
  const filteredLocations = locations.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()));

  const steps = [
    {
      title: "Where are you looking?",
      subtitle: "Find homes in your ideal neighborhood",
      content: (
        <div className="space-y-3">
          <Input
            placeholder="Search neighborhoods..."
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            data-testid="input-onboarding-location"
          />
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {filteredLocations.map((loc) => (
              <button
                key={loc}
                onClick={() => { setData(d => ({ ...d, location: loc })); setLocationSearch(loc); }}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                  data.location === loc
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/5 text-white/80 hover-elevate"
                }`}
                data-testid={`button-location-${loc.replace(/[,\s]/g, '-').toLowerCase()}`}
              >
                <MapPin className="w-3.5 h-3.5 inline mr-2 opacity-60" />
                {loc}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "What's your budget?",
      subtitle: "Set your comfortable price range",
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Minimum</Label>
              <p className="text-2xl font-bold">${data.budgetMin >= 1000000 ? `${(data.budgetMin / 1000000).toFixed(1)}M` : `${(data.budgetMin / 1000).toFixed(0)}K`}</p>
            </div>
            <div className="text-muted-foreground">to</div>
            <div className="space-y-1 text-right">
              <Label className="text-muted-foreground text-xs">Maximum</Label>
              <p className="text-2xl font-bold">${data.budgetMax >= 1000000 ? `${(data.budgetMax / 1000000).toFixed(1)}M` : `${(data.budgetMax / 1000).toFixed(0)}K`}</p>
            </div>
          </div>
          <Slider
            min={50000}
            max={10000000}
            step={25000}
            value={[data.budgetMin, data.budgetMax]}
            onValueChange={([min, max]) => setData(d => ({ ...d, budgetMin: min, budgetMax: max }))}
            minStepsBetweenThumbs={2}
            data-testid="slider-budget-range"
          />
        </div>
      ),
    },
    {
      title: "How many bedrooms?",
      subtitle: "Select your space requirements",
      content: (
        <div className="flex flex-wrap gap-3 justify-center">
          {["Studio", "1", "2", "3+"].map((opt) => (
            <button
              key={opt}
              onClick={() => setData(d => ({ ...d, bedrooms: opt }))}
              className={`px-6 py-3 rounded-md text-sm font-medium transition-all ${
                data.bedrooms === opt
                  ? "bg-primary text-primary-foreground scale-105"
                  : "bg-white/5 text-white/80 hover-elevate"
              }`}
              data-testid={`button-bedroom-${opt.toLowerCase().replace('+', 'plus')}`}
            >
              {opt === "Studio" ? "Studio" : `${opt} BR`}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "What's your vibe?",
      subtitle: "Choose your style preference",
      content: (
        <div className="grid grid-cols-1 gap-3">
          {[
            { id: "modern", label: "Modern", desc: "Clean lines, open spaces, minimalist design" },
            { id: "classic", label: "Classic", desc: "Timeless elegance, rich materials, ornate details" },
            { id: "industrial", label: "Industrial", desc: "Exposed brick, raw textures, urban character" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setData(d => ({ ...d, vibe: opt.id }))}
              className={`text-left p-4 rounded-md transition-all ${
                data.vibe === opt.id
                  ? "bg-primary/20 border border-primary/40"
                  : "bg-white/5 border border-white/5 hover-elevate"
              }`}
              data-testid={`button-vibe-${opt.id}`}
            >
              <p className={`font-semibold text-sm ${data.vibe === opt.id ? "text-primary" : "text-white"}`}>
                {opt.label}
              </p>
              <p className="text-xs text-white/50 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const canProceed = step === 0 ? data.location !== "" : true;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i <= step ? "w-8 bg-primary" : "w-4 bg-white/10"
                  }`}
                />
              ))}
            </div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-onboarding-title">{currentStep.title}</h2>
            <p className="text-muted-foreground text-sm">{currentStep.subtitle}</p>
          </div>

          {currentStep.content}

          <div className="flex gap-3 pt-4">
            {step > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(s => s - 1)}
                data-testid="button-onboarding-back"
              >
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => {
                if (step < steps.length - 1) setStep(s => s + 1);
                else onComplete(data);
              }}
              disabled={!canProceed}
              data-testid="button-onboarding-next"
            >
              {step === steps.length - 1 ? "Find Homes" : "Continue"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function triggerHaptic(pattern: number | number[] = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

function computeMatchScore(
  property: Property,
  filters: OnboardingData | null,
): number {
  if (!filters) return 0;
  let score = 0;
  let maxScore = 0;

  maxScore += 30;
  if (filters.vibe && property.vibe === filters.vibe) score += 30;

  maxScore += 30;
  const bedroomTarget = filters.bedrooms === "Studio" ? 0 : parseInt(filters.bedrooms.replace("+", ""), 10);
  if (property.bedrooms === bedroomTarget) score += 30;
  else if (Math.abs(property.bedrooms - bedroomTarget) === 1) score += 15;

  maxScore += 30;
  if (property.price >= (filters.budgetMin || 0) && property.price <= (filters.budgetMax || Infinity)) {
    score += 30;
  } else if (property.price < (filters.budgetMin || 0)) {
    const diff = ((filters.budgetMin || 0) - property.price) / (filters.budgetMin || 1);
    if (diff < 0.2) score += 15;
  }

  if (filters.budgetMax && property.price < filters.budgetMax * 0.9) {
    score += 5;
    maxScore += 5;
  } else {
    maxScore += 5;
  }

  if (property.bedrooms === bedroomTarget) {
    score += 5;
    maxScore += 5;
  } else {
    maxScore += 5;
  }

  return Math.round((score / maxScore) * 100);
}

function MatchBadge({ score }: { score: number }) {
  const tier = score >= 90 ? "dream" : score >= 70 ? "gold" : "ghost";
  const colors = {
    dream: "from-emerald-400 to-green-500 shadow-emerald-500/40",
    gold: "from-amber-400 to-yellow-500 shadow-amber-500/40",
    ghost: "from-zinc-400 to-zinc-500 shadow-zinc-500/20",
  };
  const labels = { dream: "Dream Home", gold: "Great Match", ghost: "Explore" };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 20 }}
      className="absolute top-12 right-3 z-20"
      data-testid={`badge-match-${tier}`}
    >
      <div
        className={`relative bg-gradient-to-r ${colors[tier]} rounded-md px-2.5 py-1.5 shadow-lg`}
      >
        {tier === "dream" && (
          <motion.div
            className="absolute inset-0 rounded-md bg-gradient-to-r from-emerald-400 to-green-500 opacity-60"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-bold">{score}%</span>
        </div>
        <p className="relative text-white/80 text-[10px] font-medium mt-0.5 leading-none">{labels[tier]}</p>
      </div>
    </motion.div>
  );
}

function SwipeCard({
  property,
  onSwipe,
  isTop,
  filters,
}: {
  property: Property;
  onSwipe: (dir: "left" | "right") => void;
  isTop: boolean;
  filters: OnboardingData | null;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const images = (property.images && property.images.length > 0)
    ? property.images
    : ["/images/property-1.png"];
  const [photoIndex, setPhotoIndex] = useState(0);
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const matchScore = computeMatchScore(property, filters);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartTime.current = Date.now();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  }, []);

  const handleDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 100;
    if (Math.abs(info.offset.x) > threshold) {
      const dir = info.offset.x > 0 ? "right" : "left";
      const flyTo = info.offset.x > 0 ? 600 : -600;
      if (dir === "right") triggerHaptic([15, 30, 15]);
      animate(x, flyTo, {
        type: "spring",
        stiffness: 300,
        damping: 30,
        onComplete: () => onSwipe(dir),
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
    setTimeout(() => { isDragging.current = false; }, 50);
  }, [onSwipe, x]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) return;
    const elapsed = Date.now() - dragStartTime.current;
    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    if (elapsed > 250 || dx > 10 || dy > 10) return;

    if (images.length <= 1) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;

    if (relativeX < 0.3) {
      setPhotoIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      triggerHaptic(5);
    } else if (relativeX > 0.7) {
      setPhotoIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      triggerHaptic(5);
    }
  }, [images.length]);

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1,
        scale: isTop ? 1 : 0.95,
        zIndex: isTop ? 10 : 5,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragStart={isTop ? handleDragStart : undefined}
      onDragEnd={isTop ? handleDragEnd : undefined}
      data-testid={`card-swipe-${property.id}`}
    >
      <div
        className="w-full h-full rounded-2xl overflow-hidden relative shadow-2xl"
        onPointerDown={isTop ? handlePointerDown : undefined}
        onClick={isTop ? handleTap : undefined}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={photoIndex}
            src={images[photoIndex]}
            alt={`${property.title} photo ${photoIndex + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.6 }}
            transition={{ duration: 0.2 }}
            data-testid={`img-swipe-photo-${property.id}`}
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {images.length > 1 && (
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-2" data-testid={`gallery-progress-${property.id}`}>
            {images.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={false}
                  animate={{ width: i === photoIndex ? "100%" : i < photoIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>
        )}

        {isTop && <MatchBadge score={matchScore} />}

        {isTop && (
          <>
            <motion.div
              className="absolute top-14 left-4 px-4 py-2 rounded-md border-2 border-red-500 text-red-500 font-bold text-xl -rotate-12"
              style={{ opacity: passOpacity }}
            >
              PASS
            </motion.div>
            <motion.div
              className="absolute top-14 left-4 px-4 py-2 rounded-md border-2 border-green-500 text-green-500 font-bold text-xl rotate-12"
              style={{ opacity: likeOpacity }}
            >
              LIKE
            </motion.div>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 m-3 rounded-xl backdrop-blur-md bg-white/10 border border-white/10 p-4 space-y-2" data-testid={`glass-specs-${property.id}`}>
          <h2 className="text-xl font-bold text-white" data-testid={`text-swipe-title-${property.id}`}>{property.title}</h2>
          <p className="text-lg font-bold text-primary">${property.price.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 text-white/80 text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span>{property.location}</span>
          </div>
          <div className="flex items-center gap-4 text-white/70 text-sm flex-wrap">
            <div className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />
              <span>{property.bedrooms} beds</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />
              <span>{property.bathrooms} baths</span>
            </div>
            <div className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              <span>{property.sqft.toLocaleString()} sqft</span>
            </div>
          </div>
        </div>

        {isTop && images.length > 1 && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-[30%] z-10" data-testid={`tap-zone-prev-${property.id}`} />
            <div className="absolute right-0 top-0 bottom-0 w-[30%] z-10" data-testid={`tap-zone-next-${property.id}`} />
          </>
        )}
      </div>
    </motion.div>
  );
}

function MatchOverlay({ property, onClose }: { property: Property; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leads", {
        propertyId: property.id,
        name,
        phone,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Details unlocked! An agent will contact you soon." });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl p-6 space-y-5"
      >
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
            className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto"
          >
            <Heart className="w-8 h-8 text-primary" />
          </motion.div>
          <h2 className="text-xl font-bold" data-testid="text-match-title">It's a Match!</h2>
          <p className="text-sm text-muted-foreground">
            Unlock the address and agent details for <span className="font-medium text-foreground">{property.title}</span>
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Your Name</Label>
            <Input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-lead-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Phone Number</Label>
            <Input
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-lead-phone"
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => submitMutation.mutate()}
          disabled={!name.trim() || !phone.trim() || submitMutation.isPending}
          data-testid="button-submit-lead"
        >
          {submitMutation.isPending ? "Submitting..." : "Unlock Details"}
        </Button>

        <button
          onClick={onClose}
          className="w-full text-center text-xs text-muted-foreground py-1"
          data-testid="button-skip-match"
        >
          Maybe later
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function Consumer() {
  const [filters, setFilters] = useState<OnboardingData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchProperty, setMatchProperty] = useState<Property | null>(null);
  const [swipedIds, setSwipedIds] = useState<Set<number>>(new Set());

  const buildQuery = () => {
    if (!filters) return "/api/properties";
    const params = new URLSearchParams();
    if (filters.location) params.set("location", filters.location);
    if (filters.budgetMin) params.set("minPrice", filters.budgetMin.toString());
    if (filters.budgetMax) params.set("maxPrice", filters.budgetMax.toString());
    if (filters.bedrooms && filters.bedrooms !== "Studio") {
      params.set("bedrooms", filters.bedrooms.replace("+", ""));
    }
    if (filters.vibe) params.set("vibe", filters.vibe);
    params.set("status", "active");
    return `/api/properties?${params.toString()}`;
  };

  const buildFallbackQuery = () => {
    if (!filters) return "/api/properties";
    const params = new URLSearchParams();
    if (filters.location) params.set("location", filters.location);
    if (filters.budgetMin) params.set("minPrice", filters.budgetMin.toString());
    if (filters.budgetMax) params.set("maxPrice", filters.budgetMax.toString());
    if (filters.bedrooms && filters.bedrooms !== "Studio") {
      params.set("bedrooms", filters.bedrooms.replace("+", ""));
    }
    params.set("status", "active");
    return `/api/properties?${params.toString()}`;
  };

  const { data: filteredProperties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties", filters],
    queryFn: async () => {
      const res = await fetch(buildQuery());
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.length > 0) return data;
      const fallbackRes = await fetch(buildFallbackQuery());
      if (!fallbackRes.ok) throw new Error("Failed to fetch");
      return fallbackRes.json();
    },
    enabled: filters !== null,
  });

  const allProperties = filteredProperties;

  const properties = (allProperties?.filter(p => !swipedIds.has(p.id)) ?? []).sort((a, b) => {
    if (filters?.vibe) {
      const aMatch = a.vibe === filters.vibe ? 0 : 1;
      const bMatch = b.vibe === filters.vibe ? 0 : 1;
      return aMatch - bMatch;
    }
    return 0;
  });

  const handleSwipe = (dir: "left" | "right") => {
    const property = properties[0];
    if (!property) return;

    setSwipedIds(prev => new Set(prev).add(property.id));

    if (dir === "right") {
      triggerHaptic([15, 30, 15]);
      setMatchProperty(property);
    }
  };

  const resetFilters = () => {
    setFilters(null);
    setSwipedIds(new Set());
    setCurrentIndex(0);
  };

  if (!filters) {
    return <OnboardingWizard onComplete={setFilters} />;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Finding your dream homes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 p-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={resetFilters} data-testid="button-reset-filters">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg" data-testid="text-consumer-title">Discover</h1>
        <Button variant="ghost" size="icon" onClick={resetFilters} data-testid="button-adjust-filters">
          <SlidersHorizontal className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex-1 relative overflow-hidden">
        {properties.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center space-y-3 max-w-xs">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg" data-testid="text-empty-state">You've caught up!</h3>
              <p className="text-muted-foreground text-sm">
                No more properties match your filters. Try adjusting your preferences.
              </p>
              <Button onClick={resetFilters} data-testid="button-adjust-filters-empty">
                Adjust Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-4 sm:inset-8 md:inset-12 max-w-md mx-auto">
            {properties.slice(0, 2).reverse().map((property, i) => (
              <SwipeCard
                key={property.id}
                property={property}
                onSwipe={handleSwipe}
                isTop={i === (Math.min(properties.length, 2) - 1)}
                filters={filters}
              />
            ))}
          </div>
        )}
      </div>

      {properties.length > 0 && (
        <div className="flex items-center justify-center gap-6 p-4 pb-6 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="w-14 h-14 rounded-full border-red-500/30 text-red-500"
            onClick={() => handleSwipe("left")}
            data-testid="button-swipe-pass"
          >
            <XIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-14 h-14 rounded-full border-green-500/30 text-green-500"
            onClick={() => handleSwipe("right")}
            data-testid="button-swipe-like"
          >
            <Heart className="w-6 h-6" />
          </Button>
        </div>
      )}

      {matchProperty && (
        <MatchOverlay
          property={matchProperty}
          onClose={() => setMatchProperty(null)}
        />
      )}
    </div>
  );
}
