import { readFileSync } from "node:fs";
import { generateHeuristicPlan, loadCatalog, validatePlanAgainstCatalog } from "./planner";

const catalog = loadCatalog("staging/catalog.v1.json");
const room = JSON.parse(readFileSync("staging/example.room.json", "utf8"));

const plan = generateHeuristicPlan(room, catalog);
const validation = validatePlanAgainstCatalog(plan, catalog);

if (!validation.ok) {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(plan, null, 2));
