import { HARD_CONSTRAINT_BLOCK } from "./promptBuilder";

const REQUIRED_PHRASES = [
  "Preserve the room’s architecture and geometry",
  "Keep the same camera angle",
  "Do not renovate",
  "Do not change floors, walls, windows, doors, ceiling, or built-ins",
  "Only add furniture, decor, lighting, rugs, textiles, plants, and art",
];

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

  for (const phrase of REQUIRED_PHRASES) {
    if (!prompt.includes(phrase)) {
      flags.push(`missing_required_phrase:${phrase}`);
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
