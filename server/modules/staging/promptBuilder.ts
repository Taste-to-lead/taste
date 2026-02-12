import { VIBE_DEFINITIONS } from "@shared/tasteAlgorithm";
import type { RoomType, VibeId } from "./stagingTypes";

const HARD_CONSTRAINT_BLOCK =
  "IMPORTANT: You are an interior designer staging this exact room. Preserve the room’s architecture and geometry. Keep the same camera angle. Do not renovate. Do not change floors, walls, windows, doors, ceiling, or built-ins. Only add furniture, decor, lighting, rugs, textiles, plants, and art.";

const BASE_NEGATIVE_PROMPT =
  "renovation, remodel, construction, carpentry, new window, new door, remove wall, add wall, change flooring, change ceiling, change layout, built-in cabinetry, structural beams, demolition";

export function buildStagingPrompt({
  vibeId,
  roomType,
  optionalRoomNotes,
  strictness = "normal",
}: {
  vibeId: VibeId;
  roomType: RoomType;
  optionalRoomNotes?: string;
  strictness?: "normal" | "strict";
}): { prompt: string; negativePrompt: string } {
  const def = VIBE_DEFINITIONS[vibeId];
  const designPrinciples = def.psychology.join(", ");
  const furnitureKit = def.stagingStyleRules.do.join(", ");
  const visualKeywords = def.visualCues.join(", ");

  const prompt = [
    HARD_CONSTRAINT_BLOCK,
    `Room type: ${roomType}.`,
    optionalRoomNotes ? `Room notes: ${optionalRoomNotes}.` : "",
    `Vibe: ${vibeId}.`,
    `Design principles: ${designPrinciples}.`,
    `Furniture kit: ${furnitureKit}.`,
    `Visual keywords: ${visualKeywords}.`,
    "Allowed additions only: furniture, decor, textiles, lighting fixtures, wall art, plants, rugs, accessories.",
    "Do not modify floors, walls, windows, doors, ceiling, built-ins, cabinetry, or any structural element.",
    "Composition: photorealistic, natural lighting, interior photography, coherent scale, realistic shadows.",
  ]
    .filter(Boolean)
    .join(" ");

  const vibeNegative = def.forbiddenChanges.join(", ");
  const strictSuffix = strictness === "strict" ? ", ABSOLUTELY NO ARCHITECTURAL CHANGES" : "";
  const negativePrompt = `${BASE_NEGATIVE_PROMPT}, ${vibeNegative}${strictSuffix}`;

  return { prompt, negativePrompt };
}

export { HARD_CONSTRAINT_BLOCK, BASE_NEGATIVE_PROMPT };
