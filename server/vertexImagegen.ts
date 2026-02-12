import { PredictionServiceClient, helpers } from "@google-cloud/aiplatform";
import type { protos } from "@google-cloud/aiplatform";

const PROJECT_ID = "gen-lang-client-0912710356";
const LOCATION = "us-central1";
const MODEL = "imagen-3.0-generate-001";

export interface ImageGenerationResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  error?: string;
  safetyBlocked?: boolean;
}

export async function generateStagedImage(
  prompt: string,
  _referenceImage?: string
): Promise<ImageGenerationResult> {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      return {
        success: false,
        error: "GOOGLE_APPLICATION_CREDENTIALS not configured",
      };
    }

    const client = new PredictionServiceClient({
      keyFilename: credentialsPath,
      apiEndpoint: "us-central1-aiplatform.googleapis.com",
    });

    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

    // imagen-3.0-generate-001 is a text-to-image model.
    // The Gemini analysis step already produces a detailed architectural prompt
    // describing the room geometry, lighting, and target vibe — so text-to-image
    // generates a faithful staged version.
    const instance = helpers.toValue({
      prompt,
    }) as protos.google.protobuf.IValue;

    const parameters = helpers.toValue({
      sampleCount: 1,
      aspectRatio: "4:3",
    }) as protos.google.protobuf.IValue;

    const request: protos.google.cloud.aiplatform.v1.IPredictRequest = {
      endpoint,
      instances: [instance],
      parameters,
    };

    console.log(
      `[VertexImagegen] Generating text-to-image for prompt (${prompt.length} chars)`
    );

    const response = await client.predict(request);

    if (!response[0]?.predictions || response[0].predictions.length === 0) {
      return {
        success: false,
        error: "No image generated — empty predictions array",
      };
    }

    const prediction = response[0].predictions[0] as any;

    // Check for safety filter blocks
    if (prediction.structValue?.fields?.safetyAttributes) {
      const safetyAttr = prediction.structValue.fields.safetyAttributes;
      if (safetyAttr.structValue?.fields?.blocked?.boolValue === true) {
        console.warn("[VertexImagegen] Image blocked by safety filter");
        return {
          success: false,
          safetyBlocked: true,
          error: "Image generation blocked by safety filter. Please try a different prompt or room description.",
        };
      }
    }

    // Imagen 3 returns the field as "bytesBase64Encoded"
    const bytesValue =
      prediction.structValue?.fields?.bytesBase64Encoded?.stringValue;
    if (!bytesValue) {
      // Log the available fields for debugging
      const availableFields = prediction.structValue?.fields
        ? Object.keys(prediction.structValue.fields)
        : [];
      console.error(
        `[VertexImagegen] No image data in response. Available fields: ${JSON.stringify(availableFields)}`
      );
      return {
        success: false,
        error: `No image data in response. Fields found: ${availableFields.join(", ") || "none"}`,
      };
    }

    console.log("[VertexImagegen] Image generated successfully");
    return {
      success: true,
      imageData: bytesValue,
    };
  } catch (error: any) {
    console.error("[VertexImagegen] Error:", error.message);

    // Re-throw rate limit / quota errors so the retry wrapper can handle them
    if (error.message?.includes("quota") || error.message?.includes("429") || error.message?.includes("Resource exhausted")) {
      throw error;
    }

    if (
      error.message?.includes("permission") ||
      error.message?.includes("403")
    ) {
      return {
        success: false,
        error: "Vertex AI API not enabled or insufficient permissions. Check your Google Cloud console.",
      };
    }

    return {
      success: false,
      error: `Image generation failed: ${error.message}`,
    };
  }
}
