import { readFileSync } from "node:fs";

type Zone =
  | "Wall A"
  | "Wall B"
  | "Wall C"
  | "Wall D"
  | "Center"
  | "Corner 1"
  | "Corner 2"
  | "Window Wall"
  | "Sofa Zone"
  | "Bed Zone";

type RoomType = "living_room" | "bedroom" | "dining_room" | "office" | "entryway";

export type RoomInput = {
  room_type: RoomType | string;
  vibe: string;
  dimensions_ft: {
    length: number;
    width: number;
    ceiling_height: number;
  };
};

export type StagingPlan = {
  room: {
    room_type: string;
    dimensions_ft: {
      length: number;
      width: number;
      ceiling_height: number;
    };
  };
  vibe: string;
  selected_items: Array<{
    item_id: string;
    reason: string;
  }>;
  placement_plan: Array<{
    item_id: string;
    zone: Zone;
    position_notes: string;
  }>;
  constraints: {
    allowed_item_ids_only: boolean;
    no_new_items: boolean;
  };
};

export type CatalogItem = {
  id: string;
  category: string;
  name: string;
  vibe_tags: string[];
  style_tags: string[];
  palette: string[];
  materials: string[];
  price_tier: string;
  sizes_in: Array<[number, number]>;
  notes: string;
};

export type Catalog = {
  version: string;
  allowed_room_types: string[];
  allowed_vibes: string[];
  categories: string[];
  items: CatalogItem[];
};

export function loadCatalog(path: string): Catalog {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Catalog;
}

export function validatePlanAgainstCatalog(
  plan: any,
  catalog: Catalog,
): { ok: boolean; errors: string[]; invalid_item_ids: string[] } {
  const errors: string[] = [];
  const idSet = new Set(catalog.items.map((item) => item.id));
  const invalid = new Set<string>();

  if (!plan || typeof plan !== "object") {
    return {
      ok: false,
      errors: ["Plan must be an object"],
      invalid_item_ids: [],
    };
  }

  if (!Array.isArray(plan.selected_items)) {
    errors.push("selected_items must be an array");
  } else {
    for (const entry of plan.selected_items) {
      if (!entry || typeof entry.item_id !== "string") {
        errors.push("selected_items entries must include item_id");
        continue;
      }
      if (!idSet.has(entry.item_id)) invalid.add(entry.item_id);
    }
  }

  if (!Array.isArray(plan.placement_plan)) {
    errors.push("placement_plan must be an array");
  } else {
    for (const entry of plan.placement_plan) {
      if (!entry || typeof entry.item_id !== "string") {
        errors.push("placement_plan entries must include item_id");
        continue;
      }
      if (!idSet.has(entry.item_id)) invalid.add(entry.item_id);
    }
  }

  const invalid_item_ids = Array.from(invalid);
  if (invalid_item_ids.length > 0) {
    errors.push("Plan contains item_id values not present in catalog");
  }

  return {
    ok: errors.length === 0,
    errors,
    invalid_item_ids,
  };
}

function chooseRugSizeByRoom(
  item: CatalogItem,
  length: number,
  width: number,
): { size: [number, number] | undefined; index: number; tier: "small" | "medium" | "large" } {
  if (!item.sizes_in || item.sizes_in.length === 0) {
    return { size: undefined, index: 0, tier: "small" };
  }

  const minSide = Math.min(length, width);
  let wantedIndex = 0;
  let tier: "small" | "medium" | "large" = "small";
  if (minSide < 10) {
    wantedIndex = 0;
    tier = "small";
  } else if (minSide <= 13) {
    wantedIndex = 1;
    tier = "medium";
  } else {
    wantedIndex = 2;
    tier = "large";
  }

  // Photo-friendly upscale override for larger rooms.
  if (length >= 14 && width >= 12 && item.sizes_in[2]) {
    wantedIndex = 2;
    tier = "large";
  }

  const index = Math.min(wantedIndex, item.sizes_in.length - 1);
  return { size: item.sizes_in[index], index, tier };
}

function zoneForCategory(category: string): Zone {
  if (category === "rug" || category === "coffee_table") return "Center";
  if (category === "drapes") return "Window Wall";
  if (category === "wall_art") return "Wall A";
  if (category === "mirror") return "Wall B";
  if (category === "lighting_floor" || category === "lighting_table" || category === "plant" || category === "accent_chair") {
    return "Corner 1";
  }
  return "Wall C";
}

function isLargeCategory(category: string): boolean {
  return (
    category === "rug" ||
    category === "coffee_table" ||
    category === "accent_chair" ||
    category === "lighting_floor" ||
    category === "mirror"
  );
}

function zoneCandidates(category: string, preferred: Zone): Zone[] {
  if (category === "accent_chair") return ["Corner 2", "Sofa Zone", "Corner 1"];
  if (category === "lighting_floor") return ["Corner 1", "Corner 2"];
  if (category === "plant") return ["Corner 2", "Corner 1"];
  if (category === "coffee_table") return ["Sofa Zone", "Center"];
  if (category === "mirror") return ["Wall B", "Wall C", "Wall D"];
  return [preferred];
}

function uniquePush(target: CatalogItem[], candidate: CatalogItem | undefined): void {
  if (!candidate) return;
  if (target.some((item) => item.id === candidate.id)) return;
  target.push(candidate);
}

function scoreItem(
  item: CatalogItem,
  vibe: string,
  desiredStyle: Set<string>,
  desiredPalette: Set<string>,
): number {
  let score = 0;
  if (item.vibe_tags.includes(vibe)) score += 100;
  for (const tag of item.style_tags) if (desiredStyle.has(tag)) score += 3;
  for (const color of item.palette) if (desiredPalette.has(color)) score += 2;
  return score;
}

function pickBest(
  items: CatalogItem[],
  vibe: string,
  desiredStyle: Set<string>,
  desiredPalette: Set<string>,
  excludeIds: Set<string>,
): CatalogItem | undefined {
  const ranked = items
    .filter((item) => !excludeIds.has(item.id))
    .map((item) => ({
      item,
      score: scoreItem(item, vibe, desiredStyle, desiredPalette),
    }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  return ranked[0]?.item;
}

export function generateHeuristicPlan(room: RoomInput, catalog: Catalog): StagingPlan {
  const vibe = room.vibe;
  const byCategory = (category: string) => catalog.items.filter((item) => item.category === category);

  const vibeMatched = catalog.items.filter((item) => item.vibe_tags.includes(vibe));
  const desiredStyle = new Set(vibeMatched.flatMap((item) => item.style_tags));
  const desiredPalette = new Set(vibeMatched.flatMap((item) => item.palette));

  const selected: CatalogItem[] = [];
  const selectedIds = new Set<string>();

  const rug = pickBest(byCategory("rug"), vibe, desiredStyle, desiredPalette, selectedIds);
  uniquePush(selected, rug);
  if (rug) selectedIds.add(rug.id);

  const lightingPool = [...byCategory("lighting_floor"), ...byCategory("lighting_table")];
  const lighting = pickBest(lightingPool, vibe, desiredStyle, desiredPalette, selectedIds);
  uniquePush(selected, lighting);
  if (lighting) selectedIds.add(lighting.id);

  const wallPool = [...byCategory("wall_art"), ...byCategory("mirror")];
  const wall = pickBest(wallPool, vibe, desiredStyle, desiredPalette, selectedIds);
  uniquePush(selected, wall);
  if (wall) selectedIds.add(wall.id);

  const optionalCategories = ["drapes", "plant", "accent_chair", "coffee_table", "decor_objects"];
  for (const category of optionalCategories) {
    const candidate = pickBest(byCategory(category), vibe, desiredStyle, desiredPalette, selectedIds);
    if (candidate) {
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
    if (selected.length >= 6) break;
  }

  const rugSelection = rug
    ? chooseRugSizeByRoom(rug, room.dimensions_ft.length, room.dimensions_ft.width)
    : undefined;

  const selected_items = selected.map((item) => {
    if (item.category === "rug") {
      const rugSize = rugSelection?.size;
      const sizeText = rugSize ? `${rugSize[0]}x${rugSize[1]} in` : "best available size";
      const sizeIndexText = rugSelection ? `index ${rugSelection.index}` : "index n/a";
      return {
        item_id: item.id,
        reason: `Selected for ${vibe}; rug size ${sizeText} (${sizeIndexText}, ${rugSelection?.tier ?? "small"} tier).`,
      };
    }
    const matchReason = item.vibe_tags.includes(vibe)
      ? `direct vibe match for ${vibe}`
      : "best fallback by style/palette overlap";
    return {
      item_id: item.id,
      reason: `Selected as ${matchReason}.`,
    };
  });

  const usedLargeZones = new Set<Zone>();
  const placement_plan = selected.map((item) => {
    let zone = zoneForCategory(item.category);

    if (item.category === "rug") {
      zone = "Center";
    } else if (item.category === "drapes") {
      zone = "Window Wall";
    } else if (item.category === "wall_art") {
      zone = "Wall A";
    } else {
      const candidates = zoneCandidates(item.category, zone);
      const shouldAvoidLargeUsedZone = isLargeCategory(item.category) || item.category === "plant";
      if (shouldAvoidLargeUsedZone) {
        const found = candidates.find((candidate) => !usedLargeZones.has(candidate));
        zone = found ?? candidates[0] ?? zone;
      }
    }

    if (isLargeCategory(item.category)) {
      usedLargeZones.add(zone);
    }

    let position_notes = item.notes;
    if (item.category === "rug") {
      const rugSize = rugSelection?.size;
      const sizeText = rugSize ? `${rugSize[0]}x${rugSize[1]} in` : "best available size";
      const sizeIndexText = rugSelection ? `index ${rugSelection.index}` : "index n/a";
      position_notes = `Center anchor rug using ${sizeText} (${sizeIndexText}, ${rugSelection?.tier ?? "small"} tier).`;
    } else if (item.category === "wall_art") {
      position_notes = "Primary art focal point on Wall A, centered at eye level.";
    } else if (item.category === "drapes") {
      position_notes = "Mount high and wide across window wall to elongate height.";
    }

    return {
      item_id: item.id,
      zone,
      position_notes,
    };
  });

  return {
    room: {
      room_type: room.room_type,
      dimensions_ft: {
        length: room.dimensions_ft.length,
        width: room.dimensions_ft.width,
        ceiling_height: room.dimensions_ft.ceiling_height,
      },
    },
    vibe,
    selected_items,
    placement_plan,
    constraints: {
      allowed_item_ids_only: true,
      no_new_items: true,
    },
  };
}
