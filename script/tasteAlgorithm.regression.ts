import assert from "node:assert/strict";
import { buildStagingPrompt, computeTasteScore } from "@shared/tasteAlgorithm";

const noProfileScore = computeTasteScore(undefined, "Purist");
assert.equal(noProfileScore, 0, "computeTasteScore should return 0 when no profile exists");

const fullSingleVibeScore = computeTasteScore({ Purist: 5 }, "Purist");
assert.equal(fullSingleVibeScore, 100, "computeTasteScore should return 100 when profile is one vibe");

const prompt = buildStagingPrompt({
  vibe: "Purist",
  roomDescription: "Empty primary bedroom with two windows and neutral flooring.",
});

const requiredPhrases = [
  "interior designer only",
  "no renovation",
  "no structural changes",
  "same room geometry",
  "keep windows/doors positions",
];

for (const phrase of requiredPhrases) {
  assert.ok(prompt.includes(phrase), `Prompt missing required constraint phrase: ${phrase}`);
}

console.log("tasteAlgorithm regression checks passed.");
