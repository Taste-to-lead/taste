import { GoogleGenerativeAI } from "@google/generative-ai";
import { chromium, type Page } from "playwright";
import { classifyPropertyImage } from "./geminiTagger";
import { storage } from "./storage";

interface ExtractedProperty {
  title?: string;
  description?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  location?: string;
  images?: string[];
}

interface ListingDraft {
  title?: string;
  description?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  location?: string;
  sourceUrl: string;
  images: string[];
}

type FetchMode = "direct" | "playwright";

interface PageExtractionResult {
  mode: FetchMode;
  finalUrl: string;
  text: string;
  images: string[];
}

const TEXT_EXTRACTION_PROMPT = `You are a real estate data extractor. Extract listing text fields only.

Return a JSON array with objects containing:
- title
- description
- price (number only)
- bedrooms (number)
- bathrooms (number)
- sqft (number)
- location

Rules:
- Do NOT include image URLs (set images to [] if needed).
- If this is a single listing page, return one object.
- If no listing data is present, return [].
- Return only raw JSON (no markdown).`;

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i;

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254", "metadata.google.internal"];
    if (blocked.includes(hostname)) return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function pickLargestSrcset(srcset: string): string | null {
  const parts = srcset.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  let bestUrl = "";
  let bestScore = -1;
  for (const part of parts) {
    const [urlPart, descriptor] = part.split(/\s+/, 2);
    if (!urlPart) continue;
    let score = 1;
    if (descriptor) {
      const width = descriptor.match(/(\d+)w/i);
      const ratio = descriptor.match(/(\d+(?:\.\d+)?)x/i);
      if (width) score = Number(width[1]);
      else if (ratio) score = Number(ratio[1]) * 1000;
    }
    if (score > bestScore) {
      bestScore = score;
      bestUrl = urlPart;
    }
  }
  return bestUrl || null;
}

function normalizeImageUrl(raw: string, baseUrl: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    resolved.hash = "";
    for (const param of Array.from(resolved.searchParams.keys())) {
      if (param.toLowerCase().startsWith("utm_")) resolved.searchParams.delete(param);
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function isJunkImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes(".svg")) return true;
  if (!IMAGE_EXT_RE.test(lower) && !/(jpg|jpeg|png|webp)/i.test(lower)) return true;
  if (/(logo|icon|sprite|favicon|placeholder|tracking|pixel)/i.test(lower)) return true;
  if (/(1x1|1-by-1|spacer)/i.test(lower)) return true;
  return false;
}

function stripToText(html: string): string {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 12000);
}

function isJsHeavyHost(hostname: string): boolean {
  return [
    "centurycommunities.com",
    "appfolio.com",
    "showingtimeplus.com",
    "wixsite.com",
    "webflow.io",
  ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function extractScriptImageUrlsFromHtml(html: string): string[] {
  const scriptBlocks = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const urls: string[] = [];
  const re = /(?:https?:\/\/|\/)[^"'`\s)]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'`\s)]*)?/gi;
  for (const block of scriptBlocks) {
    const matches = block.match(re) || [];
    urls.push(...matches);
  }
  return urls;
}

function extractDirectImageCandidates(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const normalized = normalizeImageUrl(raw, baseUrl);
    if (normalized && !isJunkImageUrl(normalized)) found.push(normalized);
  };

  let match: RegExpExecArray | null;
  const imgAttrRegex = /<img[^>]+(?:src|data-src|data-lazy|data-original|data-image)=["']([^"']+)["'][^>]*>/gi;
  while ((match = imgAttrRegex.exec(html)) !== null) push(match[1]);

  const srcsetRegex = /<img[^>]+(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi;
  while ((match = srcsetRegex.exec(html)) !== null) push(pickLargestSrcset(match[1]));

  const ogRegex = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  while ((match = ogRegex.exec(html)) !== null) push(match[1]);

  const bgRegex = /background-image\s*:\s*url\((['"]?)(.*?)\1\)/gi;
  while ((match = bgRegex.exec(html)) !== null) push(match[2]);

  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    if (IMAGE_EXT_RE.test(href)) push(href);
  }

  for (const scriptUrl of extractScriptImageUrlsFromHtml(html)) push(scriptUrl);
  return dedupeStrings(found);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryDismissCookieBanners(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I Agree")',
    'button:has-text("OK")',
  ];
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 800 })) {
        await button.click({ timeout: 1500 });
        await sleep(250);
      }
    } catch {
      // Best effort.
    }
  }
}

async function extractRenderedImageCandidates(page: Page): Promise<string[]> {
  const payload = await page.evaluate(() => {
    const found: string[] = [];
    const imageExt = /\.(jpg|jpeg|png|webp)(\?|$)/i;
    const cssUrlRegex = /url\((['"]?)(.*?)\1\)/gi;

    for (const meta of Array.from(document.querySelectorAll('meta[property="og:image"],meta[name="og:image"]'))) {
      const content = meta.getAttribute("content");
      if (content) found.push(content);
    }

    for (const img of Array.from(document.querySelectorAll("img"))) {
      const attrs = ["src", "data-src", "data-lazy", "data-original", "data-image"];
      for (const attr of attrs) {
        const value = img.getAttribute(attr);
        if (value) found.push(value);
      }
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
      if (srcset) found.push(srcset);
    }

    for (const el of Array.from(document.querySelectorAll("*"))) {
      const bg = window.getComputedStyle(el).backgroundImage || "";
      let match: RegExpExecArray | null;
      while ((match = cssUrlRegex.exec(bg)) !== null) {
        if (match[2]) found.push(match[2]);
      }
    }

    for (const link of Array.from(document.querySelectorAll("a[href]"))) {
      const href = link.getAttribute("href") || "";
      if (imageExt.test(href)) found.push(href);
    }

    const scriptImageRegex = /(?:https?:\/\/|\/)[^"'`\s)]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'`\s)]*)?/gi;
    for (const script of Array.from(document.querySelectorAll("script"))) {
      const text = script.textContent || "";
      const matches = text.match(scriptImageRegex) || [];
      found.push(...matches);
    }

    return found;
  });

  const baseUrl = page.url();
  const normalized = payload
    .map((candidate) => (candidate.includes(",") ? pickLargestSrcset(candidate) || candidate : candidate))
    .map((candidate) => normalizeImageUrl(candidate, baseUrl))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !isJunkImageUrl(candidate));

  return dedupeStrings(normalized);
}

export async function renderAndExtract(url: string): Promise<PageExtractionResult> {
  if (!isUrlSafe(url)) throw new Error("URL blocked by SSRF protection");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    let response: Awaited<ReturnType<Page["goto"]>> | null = null;
    try {
      response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    } catch {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    }

    const title = (await page.title()).toLowerCase();
    const isNotFound = (response?.status() || 200) >= 400 || title.includes("page not found");
    if (isNotFound) {
      try {
        const parentUrl = new URL(page.url());
        parentUrl.pathname = parentUrl.pathname.replace(/[^/]+\/?$/, "");
        await page.goto(parentUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      } catch {
        // Keep original not-found page if parent fallback fails.
      }
    }

    await tryDismissCookieBanners(page);
    await sleep(2000);

    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await sleep(300);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    const collected = new Set<string>(await extractRenderedImageCandidates(page));

    const thumbnailSelector = '[role="button"] img, .thumbnail img, .slick-slide img, [data-testid*="thumb"] img';
    const thumbnails = page.locator(thumbnailSelector);
    const thumbCount = await thumbnails.count();
    if (thumbCount > 0) {
      const clickMax = Math.min(20, thumbCount);
      for (let i = 0; i < clickMax; i++) {
        try {
          await thumbnails.nth(i).click({ timeout: 2000 });
          await sleep(250);
        } catch {
          // Ignore click misses.
        }
        for (const image of await extractRenderedImageCandidates(page)) collected.add(image);
      }
    } else {
      const nextArrow = page.locator('.slick-next, button[aria-label*="Next"], button[aria-label*="next"], .swiper-button-next').first();
      try {
        if (await nextArrow.isVisible({ timeout: 1500 })) {
          for (let i = 0; i < 15; i++) {
            try {
              await nextArrow.click({ timeout: 2000 });
              await sleep(400);
            } catch {
              break;
            }
            for (const image of await extractRenderedImageCandidates(page)) collected.add(image);
          }
        }
      } catch {
        // No arrow found.
      }
    }

    const html = await page.content();
    const text = stripToText(html);
    return {
      mode: "playwright",
      finalUrl: page.url(),
      text,
      images: dedupeStrings(Array.from(collected)),
    };
  } finally {
    await browser.close();
  }
}

async function quickDirectFetch(url: string): Promise<{ ok: boolean; html: string; finalUrl: string; images: string[]; text: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return { ok: false, html: "", finalUrl: url, images: [], text: "" };
  const html = await response.text();
  const finalUrl = response.url || url;
  return {
    ok: true,
    html,
    finalUrl,
    images: extractDirectImageCandidates(html, finalUrl),
    text: stripToText(html),
  };
}

async function fetchPageContent(url: string): Promise<PageExtractionResult> {
  if (!isUrlSafe(url)) throw new Error("URL blocked by SSRF protection");

  const direct = await quickDirectFetch(url);
  if (!direct.ok) return renderAndExtract(url);

  const hostname = new URL(direct.finalUrl).hostname.toLowerCase();
  const shouldRender =
    direct.images.length < 6 ||
    /accept cookies/i.test(direct.html) ||
    direct.html.length < 40000 ||
    isJsHeavyHost(hostname);

  if (shouldRender) return renderAndExtract(url);
  return { mode: "direct", finalUrl: direct.finalUrl, text: direct.text, images: direct.images };
}

async function validateImageWithRange(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-2048" },
      signal: AbortSignal.timeout(8000),
    });
    if (!(response.status === 200 || response.status === 206)) return false;
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType) return contentType.startsWith("image/");
    return response.ok;
  } catch {
    return false;
  }
}

async function validateImageCandidates(candidates: string[]): Promise<{ validated: string[]; unvalidated: string[] }> {
  const unvalidated = dedupeStrings(candidates).slice(0, 200);
  const validated: string[] = [];
  for (const candidate of unvalidated) {
    if (validated.length >= 30) break;
    if (await validateImageWithRange(candidate)) validated.push(candidate);
  }
  return { validated, unvalidated };
}

async function extractWithGemini(pageContent: string, sourceUrl: string): Promise<ExtractedProperty[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `${TEXT_EXTRACTION_PROMPT}\n\nSource URL: ${sourceUrl}\n\nPAGE TEXT:\n${pageContent.slice(0, 12000)}`;

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenced ? fenced[1].trim() : text;
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [parsed as ExtractedProperty];
      return parsed as ExtractedProperty[];
    } catch (error: any) {
      if (String(error?.message || "").includes("429") && attempt < maxRetries - 1) {
        await sleep((attempt + 1) * 30000);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Gemini API request failed after retries");
}

function toListingDraft(sourceUrl: string, extracted: ExtractedProperty, images: string[]): ListingDraft {
  return {
    sourceUrl,
    title: extracted.title,
    description: extracted.description,
    price: extracted.price,
    bedrooms: extracted.bedrooms,
    bathrooms: extracted.bathrooms,
    sqft: extracted.sqft,
    location: extracted.location,
    images,
  };
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

    const page = await fetchPageContent(websiteUrl);
    const { validated, unvalidated } = await validateImageCandidates(page.images);
    const importImages = validated.length >= 3 ? validated : unvalidated.slice(0, 10);

    console.log(`[WebScraper] mode used: ${page.mode}`);
    console.log(`[WebScraper] totalFoundImages=${unvalidated.length}`);
    console.log(`[WebScraper] validatedImages=${validated.length}`);
    console.log(`[WebScraper] first10Images=${unvalidated.slice(0, 10).join(", ")}`);

    const extracted = await extractWithGemini(page.text, page.finalUrl || websiteUrl);
    const listingDrafts = (extracted.length > 0 ? extracted : [{}]).map((item) =>
      toListingDraft(page.finalUrl || websiteUrl, item, importImages),
    );

    let importedCount = 0;
    for (const listing of listingDrafts) {
      try {
        const tagSource = listing.images[0] || listing.description || listing.title || "modern home";
        const vibeTag = await classifyPropertyImage(tagSource);
        await storage.createProperty({
          title: listing.title || "Imported Property",
          description: listing.description || `Imported from ${websiteUrl}`,
          price: listing.price || 500000,
          bedrooms: listing.bedrooms || 3,
          bathrooms: listing.bathrooms || 2,
          sqft: listing.sqft || 1800,
          location: listing.location || "Unknown",
          images: listing.images,
          agentId,
          status: "active",
          vibe: vibeTag === "Unclassified" ? "Classicist" : vibeTag,
          vibeTag,
          tags: [],
          organizationId,
        });
        importedCount++;
        console.log(`[WebScraper] Imported: ${listing.title || "Imported Property"} [${vibeTag}]`);
      } catch (error: any) {
        console.error(`[WebScraper] Failed to import listing: ${error.message}`);
      }
    }

    await storage.updateSyncRequest(syncRequestId, { status: "completed", importedCount });
    console.log(`[WebScraper] Import complete: ${importedCount}/${listingDrafts.length} properties`);
    return { importedCount };
  } catch (error: any) {
    console.error("[WebScraper] Import failed:", error.message);
    let friendlyError = error.message;
    if (error.message?.includes("429")) friendlyError = "AI service temporarily busy. Please try again in a minute.";
    else if (error.message?.includes("GEMINI_API_KEY")) friendlyError = "AI service not configured. Contact support.";
    await storage.updateSyncRequest(syncRequestId, { status: "failed", errorMessage: friendlyError });
    return { importedCount: 0, error: friendlyError };
  }
}
