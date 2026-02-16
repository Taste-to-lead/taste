import { VIBE_DEFINITIONS } from "@shared/tasteAlgorithm";
import { STAGING_CATALOG } from "./stagingCatalog";
import type { RoomType, VibeId } from "./stagingTypes";

const HARD_CONSTRAINT_BLOCK =
  "EDIT the provided photo to virtually stage this exact room. Preserve camera viewpoint and lens exactly as captured. Do not change architecture, layout, room boundaries, or any structural surface. Add or remove movable furniture and decor only.";

const CHECKLIST_BLOCK =
  "Checklist: Preserve camera angle and perspective. Preserve walls, floors, ceiling, windows, doors, trim, built-ins. Do not repaint or change materials. Keep lighting natural and consistent with the original photo. Add staging items only; keep scale realistic. Photorealistic; realistic shadows; no surreal artifacts.";

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
  const catalogLines = STAGING_CATALOG.map(
    (item) => `${item.id} — ${item.label} (${item.category})`
  ).join("\n");
  const strictCatalogGuard =
    strictness === "strict"
      ? "Do not add any objects not listed in Allowed staging items."
      : "";

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
    "Allowed staging items (MUST choose ONLY from these IDs; do not invent new items):",
    catalogLines,
    "Choose 5–8 items maximum. If unsure, prefer safer neutral options.",
    strictCatalogGuard,
    CHECKLIST_BLOCK,
  ]
    .filter(Boolean)
    .join(" ");

  const vibeNegative = def.forbiddenChanges.join(", ");
  const strictSuffix =
    strictness === "strict"
      ? ", ABSOLUTELY NO ARCHITECTURAL CHANGES, no perspective change, no lens change, no layout change, no structural change"
      : "";
  const negativePrompt = `${BASE_NEGATIVE_PROMPT}, ${vibeNegative}${strictSuffix}`;

  return { prompt, negativePrompt };
}

export { HARD_CONSTRAINT_BLOCK, BASE_NEGATIVE_PROMPT };

