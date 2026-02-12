import { VIBES, VIBE_DEFINITIONS, type Vibe } from "@shared/tasteAlgorithm";

export const LISTING_VIBE_ALGORITHM_VERSION = "taste-portfolio-v1";

export type ListingVibeResult = {
  vibeVector: Record<Vibe, number>;
  topVibes: Array<{ vibe: Vibe; score: number }>;
  rationale: Array<{ vibe: Vibe; matched: string[]; score: number }>;
  algorithmVersion: string;
};

type ComputeInput = {
  description?: string | null;
  photosText?: string | null;
  structured?: Record<string, unknown>;
};

export function computeListingVibeVector(input: ComputeInput): ListingVibeResult {
  const haystack = [
    input.description || "",
    input.photosText || "",
    JSON.stringify(input.structured || {}),
  ]
    .join(" ")
    .toLowerCase();

  const rawScores: Record<Vibe, number> = Object.fromEntries(
    VIBES.map((v) => [v, 0])
  ) as Record<Vibe, number>;
  const rationale: Array<{ vibe: Vibe; matched: string[]; score: number }> = [];

  for (const vibe of VIBES) {
    const def = VIBE_DEFINITIONS[vibe];
    const terms = [...def.keywords, ...def.visualCues];
    const matched = terms.filter((term) => haystack.includes(term.toLowerCase()));
    const score = Math.max(0.01, matched.length);
    rawScores[vibe] = score;
    rationale.push({ vibe, matched: matched.slice(0, 8), score: Math.round(score * 100) / 100 });
  }

  const total = Object.values(rawScores).reduce((sum, n) => sum + n, 0) || 1;
  const vibeVector = Object.fromEntries(
    VIBES.map((v) => [v, Math.round((rawScores[v] / total) * 1000) / 1000])
  ) as Record<Vibe, number>;

  const topVibes = [...VIBES]
    .map((v) => ({ vibe: v, score: Math.round(vibeVector[v] * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    vibeVector,
    topVibes,
    rationale: rationale.sort((a, b) => b.score - a.score).slice(0, 3),
    algorithmVersion: LISTING_VIBE_ALGORITHM_VERSION,
  };
}
