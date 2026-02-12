import { generateStagedImage } from "../../vertexImagegen";

export type ProviderGenerateInput = {
  inputImageUrl: string;
  prompt: string;
  negativePrompt: string;
};

export type ProviderGenerateOutput = {
  outputImageUrl: string;
  providerMeta?: Record<string, unknown>;
};

async function urlToDataUrl(imageUrl: string): Promise<string | undefined> {
  if (imageUrl.startsWith("data:image/")) return imageUrl;
  if (!/^https?:\/\//i.test(imageUrl)) return undefined;
  const response = await fetch(imageUrl);
  if (!response.ok) return undefined;
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function generateStagedImageWithProvider(
  input: ProviderGenerateInput
): Promise<ProviderGenerateOutput> {
  const referenceImage = await urlToDataUrl(input.inputImageUrl);
  const mergedPrompt = `${input.prompt}\n\nNegative prompt constraints: ${input.negativePrompt}`;
  const result = await generateStagedImage(mergedPrompt, referenceImage);
  if (!result.success || !result.imageData) {
    throw new Error(result.error || "staging_generation_failed");
  }
  return {
    outputImageUrl: `data:image/png;base64,${result.imageData}`,
    providerMeta: {
      safetyBlocked: result.safetyBlocked || false,
    },
  };
}
