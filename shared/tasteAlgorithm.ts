export const VIBES = [
  "Purist",
  "Industrialist",
  "Monarch",
  "Futurist",
  "Naturalist",
  "Curator",
  "Classicist",
  "Nomad",
] as const;

export type Vibe = typeof VIBES[number];
export type VibeOrUnclassified = Vibe | "Unclassified";

type VibeDefinition = {
  keywords: string[];
  visualCues: string[];
  psychology: string[];
  copyHook: string;
  forbiddenChanges: string[];
  stagingStyleRules: {
    do: string[];
    dont: string[];
  };
  promptSeeds: string[];
};

export const VIBE_DEFINITIONS: Record<Vibe, VibeDefinition> = {
  Purist: {
    keywords: [
      "minimalist",
      "white",
      "clean lines",
      "seamless",
      "hidden storage",
      "zero clutter",
      "monochromatic",
    ],
    visualCues: [
      "all-white interiors",
      "handleless cabinetry",
      "negative space",
      "matte natural finishes",
    ],
    psychology: ["discipline", "clarity", "focus"],
    copyHook: "clean, clear, and mentally calm",
    forbiddenChanges: ["visual clutter", "busy patterns", "heavy ornamentation"],
    stagingStyleRules: {
      do: ["keep compositions minimal", "use soft neutrals and light oak", "preserve clear walkways"],
      dont: ["over-accessorize", "mix too many colors", "introduce visually heavy furniture"],
    },
    promptSeeds: ["japandi minimalism", "museum-clean styling", "soft diffused daylight"],
  },
  Industrialist: {
    keywords: [
      "loft",
      "warehouse",
      "exposed brick",
      "concrete",
      "steel beams",
      "ductwork",
      "raw",
      "factory",
    ],
    visualCues: ["high ceilings", "metal finishes", "open mechanicals", "large grid windows"],
    psychology: ["authenticity", "strength", "bones"],
    copyHook: "raw character with confident urban edge",
    forbiddenChanges: ["hiding structural elements", "ornate traditional decor", "overly polished finishes"],
    stagingStyleRules: {
      do: ["highlight existing raw textures", "layer leather and steel accents", "use moody contrast"],
      dont: ["hide industrial bones", "use ornate traditional furniture", "over-polish surfaces"],
    },
    promptSeeds: ["urban loft styling", "charcoal and rust palette", "editorial architectural lighting"],
  },
  Monarch: {
    keywords: ["penthouse", "gold", "marble", "velvet", "crystal", "grand", "opulent", "skyline"],
    visualCues: ["black and gold contrast", "statement chandeliers", "high-gloss stone", "grand scale pieces"],
    psychology: ["status", "power", "dominance"],
    copyHook: "elevated luxury with status-forward impact",
    forbiddenChanges: ["budget-looking finishes", "small-scale casual decor", "flat low-contrast styling"],
    stagingStyleRules: {
      do: ["use premium textures", "compose with bold symmetry", "add elegant statement lighting"],
      dont: ["use budget-looking decor", "crowd the floor plan", "downgrade material richness"],
    },
    promptSeeds: ["modern luxury opulence", "black gold emerald accents", "high-contrast glam lighting"],
  },
  Futurist: {
    keywords: ["smart home", "tech", "neon", "led", "glass", "chrome", "sleek", "automated"],
    visualCues: ["integrated lighting", "reflective surfaces", "clean geometry", "high-tech accents"],
    psychology: ["innovation", "speed", "efficiency"],
    copyHook: "future-ready living with precision and control",
    forbiddenChanges: ["rustic motifs", "traditional ornament", "visual noise"],
    stagingStyleRules: {
      do: ["use sleek silhouettes", "introduce integrated LED mood lighting", "favor glossy controlled finishes"],
      dont: ["add rustic decor", "introduce visual clutter", "mix vintage traditional motifs"],
    },
    promptSeeds: ["high-tech residence", "cool white and chrome palette", "precision cinematic lighting"],
  },
  Naturalist: {
    keywords: ["sanctuary", "biophilic", "plants", "green", "retreat", "wood", "stone", "natural light"],
    visualCues: ["organic textures", "living greenery", "earthy tones", "indoor-outdoor continuity"],
    psychology: ["grounding", "peace", "wellness"],
    copyHook: "restorative, organic comfort that feels grounded",
    forbiddenChanges: ["harsh artificial lighting", "synthetic-heavy surfaces", "cold sterile palettes"],
    stagingStyleRules: {
      do: ["layer natural materials", "add biophilic greenery", "use warm daylight mood"],
      dont: ["overuse synthetic glossy finishes", "add harsh neon tones", "block natural light paths"],
    },
    promptSeeds: ["biophilic sanctuary", "sage terracotta and raw wood", "calm breathable atmosphere"],
  },
  Curator: {
    keywords: ["art", "gallery", "eclectic", "bold", "color", "statement", "unique", "mural"],
    visualCues: ["gallery walls", "sculptural pieces", "mixed eras", "expressive color composition"],
    psychology: ["expression", "storytelling", "uniqueness"],
    copyHook: "high-personality spaces that tell a story",
    forbiddenChanges: ["generic cookie-cutter styling", "muted monotony", "removing statement pieces"],
    stagingStyleRules: {
      do: ["anchor with statement art", "mix textures intentionally", "create focal vignettes"],
      dont: ["flatten into generic minimalism", "overmatch all furniture", "remove personality cues"],
    },
    promptSeeds: ["editorial eclectic interior", "gallery-forward staging", "bold collected styling"],
  },
  Classicist: {
    keywords: ["historic", "traditional", "estate", "molding", "library", "wood paneling", "heritage"],
    visualCues: ["symmetry", "antique accents", "dark woods", "timeless molding details"],
    psychology: ["legacy", "history", "respect"],
    copyHook: "timeless elegance with heritage confidence",
    forbiddenChanges: ["ultra-modern disruptions", "novelty finishes", "breaking formal balance"],
    stagingStyleRules: {
      do: ["maintain formal symmetry", "use timeless upholstery and woods", "honor architectural heritage"],
      dont: ["introduce ultra-futuristic decor", "break period harmony", "use novelty materials"],
    },
    promptSeeds: ["traditional heritage interior", "navy cream mahogany tones", "refined classic composition"],
  },
  Nomad: {
    keywords: ["boho", "travel", "collected", "rugs", "texture", "earth tones", "global", "warm"],
    visualCues: ["layered textiles", "handcrafted decor", "earthy palette", "relaxed low-profile seating"],
    psychology: ["freedom", "warmth", "experience"],
    copyHook: "warm, traveled, and lived-in global comfort",
    forbiddenChanges: ["overly formal layouts", "sterile minimalism", "single-texture flatness"],
    stagingStyleRules: {
      do: ["layer textiles and artisanal pieces", "use warm earthy tones", "build relaxed lived-in vignettes"],
      dont: ["over-formalize the space", "use sterile monochrome styling", "remove global character"],
    },
    promptSeeds: ["global boho interior", "ochre sand and deep red accents", "warm ambient mood"],
  },
};

const REQUIRED_STAGING_CONSTRAINTS = [
  "interior designer only",
  "no renovation",
  "no structural changes",
  "same room geometry",
  "keep windows/doors positions",
  "no carpentry",
  "no layout change",
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isVibe(value: string): value is Vibe {
  return (VIBES as readonly string[]).includes(value);
}

export function computeTasteProfileFromSwipes(swipedVibes: Vibe[]): {
  counts: Record<Vibe, number>;
  percentages: Record<Vibe, number>;
  topVibe: Vibe | null;
} {
  const counts = Object.fromEntries(VIBES.map((v) => [v, 0])) as Record<Vibe, number>;
  for (const vibe of swipedVibes) {
    counts[vibe] += 1;
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const percentages = Object.fromEntries(
    VIBES.map((v) => [v, total > 0 ? Math.round((counts[v] / total) * 100) : 0])
  ) as Record<Vibe, number>;

  let topVibe: Vibe | null = null;
  let topCount = 0;
  for (const vibe of VIBES) {
    if (counts[vibe] > topCount) {
      topCount = counts[vibe];
      topVibe = vibe;
    }
  }

  return { counts, percentages, topVibe: topCount > 0 ? topVibe : null };
}

export function computeTasteScore(
  tasteProfileCounts: Record<string, number> | undefined,
  propertyVibe: string | null | undefined
): number {
  if (!tasteProfileCounts || !propertyVibe || propertyVibe === "Unclassified") return 0;
  if (!isVibe(propertyVibe)) return 0;

  const total = Object.values(tasteProfileCounts).reduce(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0
  );
  if (total <= 0) return 0;

  const count = tasteProfileCounts[propertyVibe] || 0;
  if (count <= 0) return 0;
  return clamp(Math.round((count / total) * 100), 0, 100);
}

export function computeMatchScore(tasteScore: number, recencyBoost = 0): number {
  return clamp(Math.round(tasteScore + recencyBoost), 0, 100);
}

export type BuyerSwipeAction = "like" | "nope" | "save" | "skip";

const ACTION_WEIGHTS: Record<BuyerSwipeAction, number> = {
  like: 2,
  save: 4,
  skip: 0.5,
  nope: -1,
};

export function computeBuyerVibeVector(
  events: Array<{ vibe: string | null | undefined; action: BuyerSwipeAction }>
): {
  vector: Record<Vibe, number>;
  topVibes: Array<{ vibe: Vibe; score: number }>;
  rationale: Array<{ vibe: Vibe; weight: number }>;
} {
  const raw = Object.fromEntries(VIBES.map((v) => [v, 0])) as Record<Vibe, number>;
  for (const event of events) {
    if (!event.vibe || !isVibe(event.vibe)) continue;
    raw[event.vibe] += ACTION_WEIGHTS[event.action];
  }

  const normalizedBase = Object.fromEntries(
    VIBES.map((v) => [v, Math.max(raw[v], 0)])
  ) as Record<Vibe, number>;
  const total = Object.values(normalizedBase).reduce((sum, n) => sum + n, 0);
  const vector = Object.fromEntries(
    VIBES.map((v) => [v, total > 0 ? Number((normalizedBase[v] / total).toFixed(4)) : 0])
  ) as Record<Vibe, number>;

  const topVibes = [...VIBES]
    .map((v) => ({ vibe: v, score: vector[v] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const rationale = [...VIBES]
    .map((v) => ({ vibe: v, weight: Number(raw[v].toFixed(2)) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return { vector, topVibes, rationale };
}

export function computeVectorMatchScore(
  buyerVector: Partial<Record<Vibe, number>> | null | undefined,
  listingVector: Partial<Record<Vibe, number>> | null | undefined
): number {
  if (!buyerVector || !listingVector) return 0;
  let dot = 0;
  let buyerMagSq = 0;
  let listingMagSq = 0;
  for (const vibe of VIBES) {
    const b = Number(buyerVector[vibe] || 0);
    const l = Number(listingVector[vibe] || 0);
    dot += b * l;
    buyerMagSq += b * b;
    listingMagSq += l * l;
  }
  if (buyerMagSq <= 0 || listingMagSq <= 0) return 0;
  const cosine = dot / (Math.sqrt(buyerMagSq) * Math.sqrt(listingMagSq));
  return clamp(Math.round(cosine * 100), 0, 100);
}

export function buildStagingPrompt({
  vibe,
  roomDescription,
  constraints,
}: {
  vibe: string;
  roomDescription?: string;
  constraints?: string[];
}): string {
  const normalized = isVibe(vibe) ? vibe : "Classicist";
  const definition = VIBE_DEFINITIONS[normalized];

  const allConstraints = [...REQUIRED_STAGING_CONSTRAINTS, ...(constraints || [])];
  const uniqueConstraints = Array.from(new Set(allConstraints.map((c) => c.trim()).filter(Boolean)));

  return [
    "Photorealistic virtual staging prompt for Imagen.",
    `Style target: ${normalized}.`,
    `Room context: ${roomDescription?.trim() || "empty room for virtual staging"}.`,
    `Design cues: ${definition.promptSeeds.join(", ")}.`,
    `Visual cues: ${definition.visualCues.join(", ")}.`,
    `Do: ${definition.stagingStyleRules.do.join("; ")}.`,
    `Do not: ${definition.stagingStyleRules.dont.join("; ")}.`,
    `Constraints: ${uniqueConstraints.join(", ")}.`,
    "Use only furniture and decor styling changes; preserve architecture and perspective exactly.",
  ].join(" ");
}
