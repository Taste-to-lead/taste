import { readFileSync } from "node:fs";
import { loadCatalog } from "./planner";

type PlanLike = {
  selected_items?: Array<{ item_id?: string }>;
  placement_plan?: Array<{ item_id?: string; zone?: string }>;
};

function isLargeCategory(category: string): boolean {
  return (
    category === "rug" ||
    category === "coffee_table" ||
    category === "accent_chair" ||
    category === "lighting_floor" ||
    category === "mirror"
  );
}

function fail(errors: string[]): never {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

const planPath = process.argv[2];
if (!planPath) {
  fail(["Usage: npx tsx staging/audit.run.ts <path-to-plan.json>"]);
}

const catalog = loadCatalog("staging/catalog.v1.json");
const rawPlan = readFileSync(planPath, "utf8");
const plan = JSON.parse(rawPlan.replace(/^\uFEFF/, "")) as PlanLike;

const errors: string[] = [];
const catalogById = new Map(catalog.items.map((item) => [item.id, item]));
const selected = Array.isArray(plan.selected_items) ? plan.selected_items : [];
const placement = Array.isArray(plan.placement_plan) ? plan.placement_plan : [];

const selectedIds = selected
  .map((item) => (typeof item.item_id === "string" ? item.item_id : ""))
  .filter((id) => id.length > 0);
const placementIds = placement
  .map((item) => (typeof item.item_id === "string" ? item.item_id : ""))
  .filter((id) => id.length > 0);

// 1) all item IDs exist in catalog
for (const id of [...selectedIds, ...placementIds]) {
  if (!catalogById.has(id)) {
    errors.push(`Unknown item_id in plan: ${id}`);
  }
}

// 2) no duplicate item_id across selected_items
const selectedSeen = new Set<string>();
for (const id of selectedIds) {
  if (selectedSeen.has(id)) {
    errors.push(`Duplicate selected_items item_id: ${id}`);
  } else {
    selectedSeen.add(id);
  }
}

// 3) every placement_plan item_id exists in selected_items
const selectedIdSet = new Set(selectedIds);
for (const id of placementIds) {
  if (!selectedIdSet.has(id)) {
    errors.push(`placement_plan item_id not present in selected_items: ${id}`);
  }
}

// 4) required categories exist
const selectedCategories = new Set(
  selectedIds
    .map((id) => catalogById.get(id)?.category)
    .filter((category): category is string => typeof category === "string"),
);

if (!selectedCategories.has("rug")) {
  errors.push("Missing required category: rug");
}
if (!selectedCategories.has("lighting_floor") && !selectedCategories.has("lighting_table")) {
  errors.push("Missing required category: lighting_floor or lighting_table");
}
if (!selectedCategories.has("wall_art") && !selectedCategories.has("mirror")) {
  errors.push("Missing required category: wall_art or mirror");
}

// 5) no zone collision among large items
const largeZoneMap = new Map<string, string>();
for (const placementItem of placement) {
  const id = placementItem.item_id;
  const zone = placementItem.zone;
  if (typeof id !== "string" || typeof zone !== "string") continue;
  const category = catalogById.get(id)?.category;
  if (!category || !isLargeCategory(category)) continue;

  const existingId = largeZoneMap.get(zone);
  if (existingId && existingId !== id) {
    errors.push(`Large-item zone collision in "${zone}": ${existingId} and ${id}`);
  } else {
    largeZoneMap.set(zone, id);
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log("OK");
