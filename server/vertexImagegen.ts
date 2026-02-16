import { PredictionServiceClient, helpers } from "@google-cloud/aiplatform";
import type { protos } from "@google-cloud/aiplatform";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "gen-lang-client-0912710356";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const DEFAULT_EDIT_MODEL = "imagen-3.0-capability-001";
const MODEL = process.env.VERTEX_IMAGEN_MODEL || DEFAULT_EDIT_MODEL;
const ENDPOINT_OVERRIDE = process.env.VERTEX_IMAGEN_ENDPOINT;

export interface ImageGenerationResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  error?: string;
  safetyBlocked?: boolean;
}

function normalizeReferenceImage(referenceImage?: string): string | undefined {
  if (!referenceImage) return undefined;
  const trimmed = referenceImage.trim();
  if (!trimmed) return undefined;

  const dataUrlMatch = trimmed.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1].trim();
  }

  // Accept raw base64 too.
  return trimmed;
}

function extractPredictionBase64(prediction: any): string | undefined {
  if (!prediction) return undefined;
  if (typeof prediction.bytesBase64Encoded === "string") return prediction.bytesBase64Encoded;
  if (typeof prediction?.bytesBase64Encoded?.stringValue === "string") {
    return prediction.bytesBase64Encoded.stringValue;
  }
  if (typeof prediction?.structValue?.fields?.bytesBase64Encoded?.stringValue === "string") {
    return prediction.structValue.fields.bytesBase64Encoded.stringValue;
  }
  if (typeof prediction?.mapValue?.fields?.bytesBase64Encoded?.stringValue === "string") {
    return prediction.mapValue.fields.bytesBase64Encoded.stringValue;
  }
  return undefined;
}

function isSafetyBlocked(prediction: any): boolean {
  return (
    prediction?.structValue?.fields?.safetyAttributes?.structValue?.fields?.blocked?.boolValue === true ||
    prediction?.mapValue?.fields?.safetyAttributes?.structValue?.fields?.blocked?.boolValue === true ||
    prediction?.safetyAttributes?.blocked === true
  );
}

export async function generateStagedImage(
  prompt: string,
  referenceImage?: string
): Promise<ImageGenerationResult> {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      return {
        success: false,
        error: "GOOGLE_APPLICATION_CREDENTIALS not configured",
      };
    }

    const baseImage = normalizeReferenceImage(referenceImage);
    if (!baseImage) {
      return {
        success: false,
        error: "Reference image is required for staging edit requests",
      };
    }

    const client = new PredictionServiceClient({
      keyFilename: credentialsPath,
      apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
    });

    const modelForRequest =
      baseImage && !MODEL.includes("capability") ? DEFAULT_EDIT_MODEL : MODEL;
    const endpoint =
      ENDPOINT_OVERRIDE ||
      `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelForRequest}`;

    // Imagen edit/customization payload with reference image.
    const instancePayload = {
      prompt,
      referenceImages: [
        {
          referenceType: "REFERENCE_TYPE_RAW",
          referenceId: 1,
          referenceImage: {
            bytesBase64Encoded: baseImage,
          },
        },
      ],
    };

    console.log(
      `[VertexImagegen] Using reference image for edit: true; instance keys: ${Object.keys(instancePayload).join(", ")}`
    );
    if (modelForRequest !== MODEL) {
      console.warn(
        `[VertexImagegen] Model "${MODEL}" is not edit-capable. Falling back to "${modelForRequest}" for reference-image editing.`
      );
    }

    const instance = helpers.toValue(instancePayload) as protos.google.protobuf.IValue;

    const parameters = helpers.toValue({
      sampleCount: 1,
      sample_image_size: "2K",
      addWatermark: false,
      includeSafetyAttributes: true,
      negativePrompt: "",
      editMode: "EDIT_MODE_DEFAULT",
      outputOptions: {
        mimeType: "image/png",
      },
    }) as protos.google.protobuf.IValue;

    const request: protos.google.cloud.aiplatform.v1.IPredictRequest = {
      endpoint,
      instances: [instance],
      parameters,
    };

    console.log(
      `[VertexImagegen] Generating image edit for prompt (${prompt.length} chars) via model ${modelForRequest}`
    );

    const response = await client.predict(request);

    if (!response[0]?.predictions || response[0].predictions.length === 0) {
      return {
        success: false,
        error: "No image generated - empty predictions array",
      };
    }

    const prediction = response[0].predictions[0] as any;

    // Keep existing safety block handling.
    if (isSafetyBlocked(prediction)) {
      console.warn("[VertexImagegen] Image blocked by safety filter");
      return {
        success: false,
        safetyBlocked: true,
        error: "Image generation blocked by safety filter. Please try a different prompt or room description.",
      };
    }

    const bytesValue = extractPredictionBase64(prediction);
    if (!bytesValue) {
      const availableFields = prediction.structValue?.fields
        ? Object.keys(prediction.structValue.fields)
        : prediction?.mapValue?.fields
          ? Object.keys(prediction.mapValue.fields)
          : Object.keys(prediction || {});

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
