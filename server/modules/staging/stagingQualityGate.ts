import { HARD_CONSTRAINT_BLOCK } from "./promptBuilder";

const REQUIRED_CONCEPTS = [
  {
    name: "camera_preservation",
    all: ["camera"],
    any: ["angle", "perspective", "viewpoint"],
  },
  {
    name: "architecture_preservation",
    all: ["preserve"],
    any: ["walls", "windows", "doors", "ceiling", "built-ins"],
  },
  {
    name: "no_renovation",
    all: ["do not"],
    any: ["renovate", "remodel", "structural"],
  },
  {
    name: "allowed_additions_only",
    all: ["only"],
    any: ["furniture", "decor", "rugs", "lighting", "art", "plants"],
  },
] as const;

const RENOVATION_TERMS = [
  "knock down wall",
  "knock down walls",
  "add skylight",
  "new skylight",
  "change cabinetry",
  "upgrade finishes",
  "demolition",
  "remove wall",
  "add wall",
  "new window",
  "new door",
  "change flooring",
  "change layout",
];

export function assessPromptForBannedTerms(prompt: string, negativePrompt: string): string[] {
  const flags: string[] = [];
  const lowerPrompt = prompt.toLowerCase();
  const lowerNegative = negativePrompt.toLowerCase();

  if (!prompt.includes(HARD_CONSTRAINT_BLOCK)) {
    flags.push("missing_hard_constraint_block");
  }

  for (const concept of REQUIRED_CONCEPTS) {
    const hasAll = concept.all.every((token) => lowerPrompt.includes(token));
    const hasAny = concept.any.some((token) => lowerPrompt.includes(token));
    if (!hasAll || !hasAny) {
      flags.push(`missing_required_concept:${concept.name}`);
    }
  }

  for (const term of RENOVATION_TERMS) {
    if (lowerPrompt.includes(term)) {
      flags.push(`renovation_keyword_in_prompt:${term}`);
    }
  }

  if (!lowerNegative.includes("no architectural changes") && !lowerNegative.includes("change layout")) {
    flags.push("negative_prompt_not_strict_enough");
  }

  return flags;
}

export function assessOutputMetadataIfAvailable(providerMeta: any): string[] {
  const flags: string[] = [];
  if (!providerMeta) return flags;
  if (providerMeta.safetyBlocked) {
    flags.push("provider_safety_blocked");
  }
  if (providerMeta.geometryChanged === true) {
    flags.push("geometry_change_suspected");
  }
  return flags;
}

