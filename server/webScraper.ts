import { GoogleGenerativeAI } from "@google/generative-ai";
import { classifyPropertyImage } from "./geminiTagger";
import { storage } from "./storage";

interface ExtractedProperty {
  title: string;
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  location: string;
  images: string[];
}

const EXTRACTION_PROMPT = `You are a real estate data extractor. Analyze the provided content and extract ALL property listings you can find.

For EACH property listing found, extract:
- title: The property name or headline
- description: A detailed description (generate one from available info if not explicit)
- price: The listing price as a number (no currency symbols). If not found, estimate based on location/size.
- bedrooms: Number of bedrooms (default 3 if not found)
- bathrooms: Number of bathrooms (default 2 if not found)
- sqft: Square footage (estimate from bedrooms if not found: 1bed=800, 2bed=1200, 3bed=1800, 4bed=2500, 5+bed=3500)
- location: Full address or city/state
- images: Array of full image URLs related to this property (must start with https://)

IMPORTANT RULES:
- Extract real data from the page. Do NOT make up listings that aren't there.
- If this is a single property page, extract that one property.
- If this is a listings page with multiple properties, extract all of them (up to 20).
- Make sure image URLs are absolute (start with https://).
- If you cannot find any real property listings, return an empty array [].

Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
Example: [{"title":"Beautiful Home","description":"A lovely 3 bedroom...","price":500000,"bedrooms":3,"bathrooms":2,"sqft":1800,"location":"Austin, TX","images":["https://example.com/img.jpg"]}]`;

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.log(`[WebScraper] Direct fetch failed: ${response.status}, falling back to Gemini URL analysis`);
      return null;
    }
    const html = await response.text();

    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");

    const imgUrls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (src && (src.startsWith("http") || src.startsWith("//"))) {
        imgUrls.push(src.startsWith("//") ? "https:" + src : src);
      }
    }

    const ogImages: string[] = [];
    const ogRegex = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    while ((match = ogRegex.exec(html)) !== null) {
      if (match[1]) ogImages.push(match[1]);
    }

    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 12000) text = text.substring(0, 12000);

    const allImages = [...ogImages, ...imgUrls].slice(0, 20);
    const imgSection = allImages.length > 0
      ? `\n\nIMAGE URLS FOUND ON PAGE:\n${allImages.join("\n")}`
      : "";

    return text + imgSection;
  } catch (err: any) {
    console.log(`[WebScraper] Direct fetch error: ${err.message}, falling back to Gemini URL analysis`);
    return null;
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractWithGemini(pageContent: string | null, sourceUrl: string): Promise<ExtractedProperty[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let prompt: string;

  if (pageContent) {
    prompt = `${EXTRACTION_PROMPT}\n\nSource URL: ${sourceUrl}\n\nWEBPAGE CONTENT:\n${pageContent}`;
  } else {
    prompt = `${EXTRACTION_PROMPT}\n\nI need you to analyze this real estate listing URL and extract property data from it. The URL is: ${sourceUrl}\n\nPlease visit/analyze this URL and extract the property listing information. If you know this website and the URL pattern, use your knowledge to extract the property details. For image URLs, construct them based on the website's typical URL patterns if possible.`;
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      let jsonStr = text;
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      try {
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) return [parsed];
        return parsed;
      } catch {
        console.error("[WebScraper] Failed to parse Gemini response:", jsonStr.substring(0, 300));
        throw new Error("Failed to parse property data from the webpage. The page may not contain recognizable property listings.");
      }
    } catch (err: any) {
      if (err.message?.includes("429") && attempt < maxRetries - 1) {
        const waitTime = (attempt + 1) * 30000;
        console.log(`[WebScraper] Gemini rate limited, retrying in ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini API request failed after retries");
}

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    const ct = resp.headers.get("content-type") || "";
    return resp.ok && (ct.startsWith("image/") || ct.includes("octet-stream"));
  } catch {
    return false;
  }
}

export async function importFromUrl(
  syncRequestId: number,
  websiteUrl: string,
  agentId: string,
  organizationId: number | null
): Promise<{ importedCount: number; error?: string }> {
  try {
    await storage.updateSyncRequest(syncRequestId, { status: "processing" });
    console.log(`[WebScraper] Starting import from: ${websiteUrl}`);

    const pageContent = await fetchPageContent(websiteUrl);
    const extracted = await extractWithGemini(pageContent, websiteUrl);
    console.log(`[WebScraper] Gemini extracted ${extracted.length} properties`);

    if (extracted.length === 0) {
      await storage.updateSyncRequest(syncRequestId, {
        status: "completed",
        importedCount: 0,
        errorMessage: "No property listings found on this page",
      });
      return { importedCount: 0, error: "No property listings found on this page" };
    }

    let importedCount = 0;

    for (const prop of extracted) {
      try {
        const rawImages = (prop.images || [])
          .filter((img: string) => typeof img === "string" && img.startsWith("http"));

        const validImages: string[] = [];
        for (const img of rawImages.slice(0, 5)) {
          const valid = await validateImageUrl(img);
          if (valid) validImages.push(img);
        }

        const tagSource = validImages[0] || prop.description || prop.title || "modern home";
        const vibeTag = await classifyPropertyImage(tagSource);

        const title = prop.title || "Imported Property";
        const propertyData = {
          title,
          description: prop.description || "Imported from " + websiteUrl,
          price: prop.price || 500000,
          bedrooms: prop.bedrooms || 3,
          bathrooms: prop.bathrooms || 2,
          sqft: prop.sqft || 1800,
          location: prop.location || "Unknown",
          images: validImages,
          agentId,
          status: "active",
          vibe: vibeTag === "Unclassified" ? "Classicist" : vibeTag,
          vibeTag,
          tags: [] as string[],
          organizationId,
        };

        await storage.createProperty(propertyData);
        importedCount++;
        console.log(`[WebScraper] Imported: ${title} [${vibeTag}]`);
      } catch (propError: any) {
        console.error(`[WebScraper] Failed to import property: ${prop.title}`, propError.message);
      }
    }

    await storage.updateSyncRequest(syncRequestId, {
      status: "completed",
      importedCount,
    });

    console.log(`[WebScraper] Import complete: ${importedCount}/${extracted.length} properties`);
    return { importedCount };
  } catch (error: any) {
    console.error(`[WebScraper] Import failed:`, error.message);
    let friendlyError = error.message;
    if (error.message?.includes("429")) {
      friendlyError = "AI service temporarily busy. Please try again in a minute.";
    } else if (error.message?.includes("GEMINI_API_KEY")) {
      friendlyError = "AI service not configured. Contact support.";
    }
    await storage.updateSyncRequest(syncRequestId, {
      status: "failed",
      errorMessage: friendlyError,
    });
    return { importedCount: 0, error: friendlyError };
  }
}
