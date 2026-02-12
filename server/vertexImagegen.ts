import { PredictionServiceClient } from "@google-cloud/aiplatform";
import { protos } from "@google-cloud/aiplatform";

const PROJECT_ID = "gen-lang-client-0912710356";
const LOCATION = "us-central1";
const MODEL = "imagen-3.0-generate-001"; // Imagen 3

export interface ImageGenerationResult {
  success: boolean;
  imageData?: string; // Base64 encoded image
  error?: string;
  safetyBlocked?: boolean;
}

export async function generateStagedImage(
  prompt: string
): Promise<ImageGenerationResult> {
  try {
    // Initialize the client with credentials from environment
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      return {
        success: false,
        error: "GOOGLE_APPLICATION_CREDENTIALS not configured",
      };
    }

    const client = new PredictionServiceClient({
      keyFilename: credentialsPath,
    });

    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

    // Build the prediction request
    const parameters = {
      sampleCount: 1,
      aspectRatio: "1:1", // Square format
      safetyFilterLevel: "block_some",
      personGeneration: "dont_allow", // Focus on interior spaces
    };

    const instance = {
      prompt: prompt,
    };

    const instanceValue: any = { structValue: { fields: {} } };
    Object.entries(instance).forEach(([key, value]) => {
      instanceValue.structValue.fields[key] = { stringValue: value };
    });

    const parametersValue: any = { structValue: { fields: {} } };
    Object.entries(parameters).forEach(([key, value]) => {
      if (typeof value === "string") {
        parametersValue.structValue.fields[key] = { stringValue: value };
      } else if (typeof value === "number") {
        parametersValue.structValue.fields[key] = { numberValue: value };
      }
    });

    const request = {
      endpoint,
      instances: [instanceValue],
      parameters: parametersValue,
    };

    console.log(`[VertexImagegen] Generating image for prompt (${prompt.length} chars)`);

    const [response] = await client.predict(request);

    if (!response.predictions || response.predictions.length === 0) {
      return {
        success: false,
        error: "No image generated",
      };
    }

    const prediction = response.predictions[0] as any;
    
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

    // Extract the base64 image data
    const bytesValue = prediction.structValue?.fields?.bytesBase64Encoded?.stringValue;
    if (!bytesValue) {
      return {
        success: false,
        error: "No image data in response",
      };
    }

    console.log("[VertexImagegen] Image generated successfully");
    return {
      success: true,
      imageData: bytesValue,
    };
  } catch (error: any) {
    console.error("[VertexImagegen] Error:", error.message);
    
    if (error.message?.includes("quota")) {
      return {
        success: false,
        error: "Vertex AI quota exceeded. Please try again later.",
      };
    }
    
    if (error.message?.includes("permission") || error.message?.includes("403")) {
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
