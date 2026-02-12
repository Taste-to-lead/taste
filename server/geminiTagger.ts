import { GoogleGenerativeAI } from "@google/generative-ai";
import { VIBES, VIBE_DEFINITIONS } from "@shared/tasteAlgorithm";

const VALID_ARCHETYPES = VIBES;
export type Archetype = (typeof VALID_ARCHETYPES)[number] | "Unclassified";

const orderedVibes = [
  "Monarch",
  "Industrialist",
  "Purist",
  "Naturalist",
  "Futurist",
  "Curator",
  "Nomad",
  "Classicist",
] as const;

const archetypeSpec = orderedVibes
  .map((name, idx) => {
    const def = VIBE_DEFINITIONS[name];
    return `${idx + 1}. ${name.toUpperCase()}
   Keywords: "${def.keywords.join('", "')}"
   Visuals: ${def.visualCues.join(", ")}
   Psychology: ${def.psychology.join(", ")}`;
  })
  .join("\n\n");

const VIBE_BIBLE_PROMPT = `You are the "Vibe Bible" - a strict real estate archetype classifier. Analyze the property listing (image and/or description) and classify it into exactly ONE of the 8 mutually exclusive archetypes below.

THE 8 ARCHETYPES (Mutually Exclusive):

${archetypeSpec}

RULES:
- Select the SINGLE best-fit archetype from the 8 above.
- Match based on keywords in the listing text AND visual cues in the image.
- If ambiguous and the property has vibrant colors or bold art, default to "Curator".
- If ambiguous and the property has neutral/traditional elements, default to "Classicist".
- Return ONLY the single archetype word (e.g. "Monarch"). No explanation, no punctuation.`;

export async function classifyPropertyImage(imageUrl: string): Promise<Archetype> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[GeminiTagger] GEMINI_API_KEY not set, defaulting to Unclassified");
    return "Unclassified";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let result;

    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = response.headers.get("content-type") || "image/jpeg";

      result = await model.generateContent([
        VIBE_BIBLE_PROMPT,
        {
          inlineData: {
            data: base64,
            mimeType,
          },
        },
      ]);
    } else {
      result = await model.generateContent([
        `${VIBE_BIBLE_PROMPT}\n\nThe property has no image available. Classify based on this description: "${imageUrl}"`,
      ]);
    }

    const text = result.response.text().trim();
    const matched = VALID_ARCHETYPES.find(
      (a) => a.toLowerCase() === text.toLowerCase()
    );

    if (matched) {
      console.log(`[GeminiTagger] Vibe Bible classified as: ${matched}`);
      return matched;
    }

    const partialMatch = VALID_ARCHETYPES.find((a) =>
      text.toLowerCase().includes(a.toLowerCase())
    );
    if (partialMatch) {
      console.log(`[GeminiTagger] Vibe Bible partial match: ${partialMatch}`);
      return partialMatch;
    }

    console.warn(`[GeminiTagger] Unexpected response: "${text}", defaulting to Classicist`);
    return "Classicist";
  } catch (error: any) {
    console.error(`[GeminiTagger] Error: ${error.message}, defaulting to Unclassified`);
    return "Unclassified";
  }
}
