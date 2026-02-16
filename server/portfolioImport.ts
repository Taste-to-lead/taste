import type { Request } from "express";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { storage } from "./storage";
import { computeListingVibeVector } from "./listingVibeAlgorithm";

type ImportedListing = {
  title: string;
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  photoUrls: string[];
  sourceUrl: string | null;
};

type ImportProgressUpdate = {
  stage: string;
  progress: number;
  counts?: Record<string, number>;
};

type SingleListingParseResult =
  | {
      ok: true;
      listing: {
        address?: string;
        price?: number;
        beds?: number;
        baths?: number;
        sqft?: number;
        description?: string;
        images: string[];
        sourceUrl: string;
      };
    }
  | {
      ok: false;
      reason: string;
    };

const URL_IMPORT_FAIL_MESSAGE = "Couldn’t auto-detect listings from that page. Upload the CSV template instead — we’ll still vibe-tag everything.";

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(baseUrl: string, maybeRelative: string): string | null {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAddress(text: string): string | null {
  const addressRegex = /\b\d{1,6}\s+[A-Za-z0-9.'\-\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way)\b(?:[^<\n]{0,40})/i;
  const match = text.match(addressRegex);
  return match ? normalizeWhitespace(match[0]) : null;
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const raw = (match[1] || "").trim();
    if (raw) blocks.push(raw);
  }
  return blocks;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/&quot;/g, '"').replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function hasRealEstateType(value: unknown): boolean {
  const target = new Set([
    "residence",
    "house",
    "singlefamilyresidence",
    "apartment",
    "offer",
    "product",
    "realestatelisting",
  ]);
  const types = toArray(value as string | string[]);
  return types.some((t) => target.has(String(t).toLowerCase().replace(/\s+/g, "")));
}

function flattenJsonLdNodes(input: unknown): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  if (!input) return out;
  if (Array.isArray(input)) {
    for (const item of input) out.push(...flattenJsonLdNodes(item));
    return out;
  }
  if (typeof input !== "object") return out;
  const node = input as Record<string, any>;
  out.push(node);
  if (Array.isArray(node["@graph"])) {
    for (const g of node["@graph"]) out.push(...flattenJsonLdNodes(g));
  }
  return out;
}

function coerceImageUrls(raw: unknown, baseUrl: string): string[] {
  const urls = toArray(raw as any)
    .map((v) => (typeof v === "string" ? v : typeof v?.url === "string" ? v.url : ""))
    .map((v) => toAbsoluteUrl(baseUrl, v) || "")
    .filter((v) => /^https?:\/\//i.test(v));
  return Array.from(new Set(urls)).slice(0, 8);
}

function normalizeLikelyAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = normalizeWhitespace(value);
    return trimmed || null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, any>;
    const parts = [
      obj.streetAddress,
      obj.addressLocality,
      obj.addressRegion,
      obj.postalCode,
      obj.addressCountry,
    ]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) return normalizeWhitespace(parts.join(", "));
  }
  return null;
}

function readMetaContent(html: string, key: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "gi"
  );
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const content = (match[1] || "").trim();
    if (content) values.push(content);
  }
  return values;
}

function extractHeuristicImages(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && urls.length < 12) {
    const src = match[1] || "";
    const lowered = src.toLowerCase();
    if (
      lowered.includes("icon") ||
      lowered.includes("sprite") ||
      lowered.includes("logo") ||
      lowered.includes("avatar")
    ) {
      continue;
    }
    const absolute = toAbsoluteUrl(baseUrl, src);
    if (absolute && /^https?:\/\//i.test(absolute)) {
      urls.push(absolute);
    }
  }
  return Array.from(new Set(urls)).slice(0, 2);
}

function parseSingleListingFromHtml(html: string, url: string): SingleListingParseResult {
  // A) JSON-LD
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const jsonLdNodes: Record<string, any>[] = [];
  for (const block of jsonLdBlocks) {
    const parsed = safeJsonParse(block);
    jsonLdNodes.push(...flattenJsonLdNodes(parsed));
  }

  const candidateNodes = jsonLdNodes.filter((node) => hasRealEstateType(node["@type"]));
  const offerNode =
    candidateNodes.find((n) => hasRealEstateType(n["@type"]) && String(n["@type"]).toLowerCase().includes("offer")) ||
    jsonLdNodes.find((n) => n.offers || n.price);
  const mainNode =
    candidateNodes.find((n) => n.address || n.description || n.image || n.name) ||
    jsonLdNodes.find((n) => n.address || n.description || n.image || n.name);

  if (mainNode || offerNode) {
    const offers = mainNode?.offers || offerNode || {};
    const address =
      normalizeLikelyAddress(mainNode?.address) ||
      normalizeLikelyAddress(mainNode?.location?.address) ||
      normalizeLikelyAddress(mainNode?.name);
    const priceRaw = offers?.price ?? mainNode?.price;
    const price = typeof priceRaw === "number" ? priceRaw : parseNumber(String(priceRaw ?? ""));
    const description = typeof mainNode?.description === "string" ? normalizeWhitespace(mainNode.description) : undefined;
    const images = coerceImageUrls(mainNode?.image ?? offerNode?.image, url);
    const beds = parseNumber(String(mainNode?.numberOfBedrooms ?? "")) ?? undefined;
    const baths = parseNumber(String(mainNode?.numberOfBathroomsTotal ?? mainNode?.numberOfBathrooms ?? "")) ?? undefined;
    const sqft = parseNumber(String(mainNode?.floorSize?.value ?? mainNode?.floorSize ?? "")) ?? undefined;
    if (address || price || description || images.length > 0) {
      return {
        ok: true,
        listing: {
          address: address || undefined,
          price: price ?? undefined,
          beds: beds ?? undefined,
          baths: baths ?? undefined,
          sqft: sqft ?? undefined,
          description: description || undefined,
          images,
          sourceUrl: url,
        },
      };
    }
  }

  // B) OpenGraph
  const ogTitle = readMetaContent(html, "og:title")[0] || "";
  const ogDescription = readMetaContent(html, "og:description")[0] || "";
  const ogUrl = readMetaContent(html, "og:url")[0] || url;
  const ogImages = readMetaContent(html, "og:image")
    .map((img) => toAbsoluteUrl(url, img) || "")
    .filter((img) => /^https?:\/\//i.test(img));
  if (ogTitle || ogDescription || ogImages.length > 0) {
    const merged = `${ogTitle} ${ogDescription}`;
    const address = parseAddress(merged) || normalizeWhitespace(ogTitle) || undefined;
    const priceMatch = merged.match(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?/);
    const bedsMatch = merged.match(/(\d+(?:\.\d+)?)\s*(bed|beds|bedroom|bedrooms)\b/i);
    const bathsMatch = merged.match(/(\d+(?:\.\d+)?)\s*(bath|baths|bathroom|bathrooms)\b/i);
    return {
      ok: true,
      listing: {
        address,
        price: priceMatch ? parseNumber(priceMatch[0]) ?? undefined : undefined,
        beds: bedsMatch ? Number(bedsMatch[1]) : undefined,
        baths: bathsMatch ? Number(bathsMatch[1]) : undefined,
        description: ogDescription || undefined,
        images: Array.from(new Set(ogImages)).slice(0, 8),
        sourceUrl: ogUrl,
      },
    };
  }

  // C) Heuristics
  const plain = normalizeWhitespace(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
  const priceMatch = plain.match(/\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?/);
  const bedsMatch = plain.match(/(\d+(?:\.\d+)?)\s*(bed|beds|bedroom|bedrooms)\b/i);
  const bathsMatch = plain.match(/(\d+(?:\.\d+)?)\s*(bath|baths|bathroom|bathrooms)\b/i);
  const sqftMatch = plain.match(/([\d,]{3,})\s*(sq\s*ft|sqft|square\s*feet)\b/i);
  const address = parseAddress(plain) || undefined;
  const images = extractHeuristicImages(html, url);
  if (address || priceMatch || bedsMatch || bathsMatch || sqftMatch || images.length > 0) {
    return {
      ok: true,
      listing: {
        address,
        price: priceMatch ? parseNumber(priceMatch[0]) ?? undefined : undefined,
        beds: bedsMatch ? Number(bedsMatch[1]) : undefined,
        baths: bathsMatch ? Number(bathsMatch[1]) : undefined,
        sqft: sqftMatch ? parseNumber(sqftMatch[1]) ?? undefined : undefined,
        description: plain.slice(0, 1200) || undefined,
        images,
        sourceUrl: url,
      },
    };
  }

  return {
    ok: false,
    reason: "No valid JSON-LD listing node, OpenGraph listing metadata, or heuristic listing signals found",
  };
}

function extractListingsFromHtml(baseUrl: string, html: string): ImportedListing[] {
  const listings: ImportedListing[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const hrefRaw = match[1] || "";
    if (!/(listing|property|home|homes|mls|realestate)/i.test(hrefRaw)) continue;

    const sourceUrl = toAbsoluteUrl(baseUrl, hrefRaw);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);

    const index = match.index;
    const context = html.slice(Math.max(0, index - 1200), Math.min(html.length, index + 1200));
    const text = normalizeWhitespace(
      context.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ")
    );

    const priceMatch = text.match(/\$\s?[\d,]{4,}/);
    const bedsMatch = text.match(/(\d+)\s*(bed|beds|bedroom|bedrooms)\b/i);
    const bathsMatch = text.match(/(\d+(?:\.\d+)?)\s*(bath|baths|bathroom|bathrooms)\b/i);
    const sqftMatch = text.match(/([\d,]{3,})\s*(sq\s*ft|sqft|square\s*feet)\b/i);
    const address = parseAddress(text);

    if (!address || !priceMatch) continue;

    const imageMatches: string[] = [];
    const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imageMatch: RegExpExecArray | null;
    while ((imageMatch = imageRegex.exec(context)) !== null && imageMatches.length < 6) {
      const absolute = toAbsoluteUrl(baseUrl, imageMatch[1]);
      if (absolute && /^https?:\/\//i.test(absolute)) {
        imageMatches.push(absolute);
      }
    }

    const title = normalizeWhitespace(match[2].replace(/<[^>]+>/g, " ")) || address;
    listings.push({
      title,
      address,
      price: parseNumber(priceMatch[0]),
      beds: bedsMatch ? Number(bedsMatch[1]) : null,
      baths: bathsMatch ? Number(bathsMatch[1]) : null,
      sqft: sqftMatch ? parseNumber(sqftMatch[1]) : null,
      description: text.length > 20 ? text.slice(0, 1200) : null,
      photoUrls: imageMatches,
      sourceUrl,
    });
  }

  const deduped = new Map<string, ImportedListing>();
  for (const listing of listings) {
    const key = `${listing.sourceUrl || ""}|${listing.address.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, listing);
  }
  return Array.from(deduped.values());
}

function parseCsvRows(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const mapped: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const out: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      out[headers[j]] = (rows[i][j] || "").trim();
    }
    mapped.push(out);
  }
  return mapped;
}

export function csvRowsToListings(csvText: string): ImportedListing[] {
  const rows = parseCsvRows(csvText);
  return rows
    .map((row) => {
      const address = row.address || row.location || "";
      if (!address) return null;
      const photosRaw = row.photourls || row.photos || row.images || "";
      const photoUrls = photosRaw
        .split(/[|;]/)
        .map((v) => v.trim())
        .filter((v) => /^https?:\/\//i.test(v));
      return {
        title: row.title || address,
        address,
        price: parseNumber(row.price),
        beds: parseNumber(row.beds || row.bedrooms),
        baths: parseNumber(row.baths || row.bathrooms),
        sqft: parseNumber(row.sqft),
        description: row.description || null,
        photoUrls,
        sourceUrl: row.sourceurl || null,
      } as ImportedListing;
    })
    .filter((v): v is ImportedListing => !!v);
}

export async function extractListingsFromPortfolioUrl(url: string): Promise<ImportedListing[]> {
  return extractListingsFromPortfolioUrlWithProgress(url);
}

export async function extractListingsFromPortfolioUrlWithProgress(
  url: string,
  onProgress?: (update: ImportProgressUpdate) => Promise<void> | void
): Promise<ImportedListing[]> {
  await onProgress?.({ stage: "fetching", progress: 5 });
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`);
  const html = await response.text();
  await onProgress?.({ stage: "discovering URLs", progress: 15 });
  const listings = extractListingsFromHtml(url, html);
  if (listings.length < 3) {
    const single = parseSingleListingFromHtml(html, url);
    if (single.ok) {
      console.log("[PortfolioImport] Listings grid not detected; single-listing fallback succeeded");
      return [
        {
          title: single.listing.address || "Imported listing",
          address: single.listing.address || single.listing.sourceUrl,
          price: single.listing.price ?? null,
          beds: single.listing.beds ?? null,
          baths: single.listing.baths ?? null,
          sqft: single.listing.sqft ?? null,
          description: single.listing.description || null,
          photoUrls: single.listing.images || [],
          sourceUrl: single.listing.sourceUrl || url,
        },
      ];
    }

    const htmlPreview = html.slice(0, 2000);
    const debugFile = path.resolve(".local", `url-import-debug-${Date.now()}.html`);
    try {
      writeFileSync(debugFile, htmlPreview, "utf8");
    } catch {
      // best effort only
    }
    console.warn(
      `[PortfolioImport] Single-listing fallback failed. reason=${single.reason}. htmlPreview=${JSON.stringify(
        htmlPreview
      )}. debugFile=${debugFile}`
    );
    throw new Error(
      `Couldn't detect listings. Tried JSON-LD + OpenGraph + heuristics. Reason: ${single.reason}`
    );
  }
  return listings;
}

export async function runPortfolioImportJob(
  jobId: string,
  agentId: string,
  sourceListings: ImportedListing[],
  onProgress?: (update: ImportProgressUpdate) => Promise<void> | void
): Promise<"done" | "failed"> {
  let processed = 0;
  let succeeded = 0;
  let failedCount = 0;
  const discovered = sourceListings.length;
  const mediaTotal = sourceListings.reduce((sum, listing) => sum + (listing.photoUrls?.length || 0), 0);
  let mediaDownloaded = 0;

  await storage.updateImportJob(jobId, {
    status: "running",
    total: sourceListings.length,
    processed: 0,
    succeeded: 0,
    failedCount: 0,
    error: null,
  });
  await onProgress?.({
    stage: "parsing listings",
    progress: 30,
    counts: { discovered, processed: 0, mediaDownloaded: 0, mediaTotal },
  });

  for (const listing of sourceListings) {
    try {
      const existingBySource =
        listing.sourceUrl ? await storage.getPropertyByAgentAndSourceUrl(agentId, listing.sourceUrl) : undefined;
      const existingByAddress = await storage.getPropertyByAgentAndLocation(agentId, listing.address);
      const existing = existingBySource || existingByAddress;

      const vibe = computeListingVibeVector({
        description: listing.description,
        photosText: listing.photoUrls.join(" "),
        structured: {
          price: listing.price,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          sourceUrl: listing.sourceUrl,
        },
      });

      const propertyPayload: any = {
        title: listing.title || listing.address,
        description: listing.description || "Imported portfolio listing",
        price: listing.price ?? 0,
        bedrooms: listing.beds ?? 0,
        bathrooms: listing.baths ?? 0,
        sqft: listing.sqft ?? 0,
        location: listing.address,
        images: listing.photoUrls,
        sourceUrl: listing.sourceUrl,
        agentId,
        vibeTag: vibe.topVibes[0]?.vibe || "Unclassified",
        vibe: vibe.topVibes[0]?.vibe || "Classicist",
        vibeVector: vibe.vibeVector,
        vibeTop: vibe.topVibes,
        vibeRationale: vibe.rationale,
        vibeVersion: vibe.algorithmVersion,
        status: "active",
        tags: [],
      };

      if (existing) {
        await storage.updateProperty(existing.id, propertyPayload);
      } else {
        await storage.createProperty(propertyPayload);
      }
      succeeded++;
    } catch {
      failedCount++;
    } finally {
      processed++;
      mediaDownloaded += listing.photoUrls?.length || 0;
      const parsingProgress = discovered > 0 ? 30 + Math.floor((processed / discovered) * 30) : 60;
      const mediaProgress =
        mediaTotal > 0 ? 60 + Math.floor((mediaDownloaded / mediaTotal) * 25) : discovered > 0 ? 60 + Math.floor((processed / discovered) * 25) : 85;
      await storage.updateImportJob(jobId, {
        processed,
        succeeded,
        failedCount,
      });
      await onProgress?.({
        stage: parsingProgress < 60 ? "parsing listings" : "downloading media",
        progress: Math.max(parsingProgress, Math.min(mediaProgress, 85)),
        counts: { discovered, processed, succeeded, failedCount, mediaDownloaded, mediaTotal },
      });
    }
  }

  await onProgress?.({
    stage: "saving",
    progress: 90,
    counts: { discovered, processed, succeeded, failedCount, mediaDownloaded, mediaTotal },
  });

  await storage.updateImportJob(jobId, {
    status: failedCount === sourceListings.length ? "failed" : "done",
    processed,
    succeeded,
    failedCount,
    error: failedCount === sourceListings.length ? "All listings failed to import." : null,
  });

  if (failedCount === sourceListings.length) {
    await onProgress?.({
      stage: "failed",
      progress: 90,
      counts: { discovered, processed, succeeded, failedCount, mediaDownloaded, mediaTotal },
    });
    return "failed";
  } else {
    await onProgress?.({
      stage: "done",
      progress: 100,
      counts: { discovered, processed, succeeded, failedCount, mediaDownloaded, mediaTotal },
    });
    return "done";
  }
}

export async function parseCsvMultipart(req: Request): Promise<{
  agentId: string;
  csvText: string;
  filename: string;
  importSource?: string;
  importType?: string;
  localExtensions?: string;
  urlType?: string;
  urlParserStrategy?: string;
}> {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch) throw new Error("Multipart boundary missing");
  const boundary = boundaryMatch[1];

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });

  const raw = Buffer.concat(chunks).toString("utf8");
  const parts = raw.split(`--${boundary}`);
  let agentId = "";
  let csvText = "";
  let filename = "portfolio.csv";
  let importSource = "";
  let importType = "";
  let localExtensions = "";
  let urlType = "";
  let urlParserStrategy = "";

  for (const part of parts) {
    if (!part.includes("Content-Disposition")) continue;
    const [headersBlock, ...rest] = part.split("\r\n\r\n");
    if (!headersBlock || rest.length === 0) continue;
    const content = rest.join("\r\n\r\n").replace(/\r\n--$/, "").trim();

    const nameMatch = headersBlock.match(/name="([^"]+)"/i);
    const filenameMatch = headersBlock.match(/filename="([^"]+)"/i);
    const fieldName = nameMatch?.[1] || "";

    if (fieldName === "agentId") {
      agentId = content;
    } else if (fieldName === "importSource") {
      importSource = content;
    } else if (fieldName === "importType") {
      importType = content;
    } else if (fieldName === "localExtensions") {
      localExtensions = content;
    } else if (fieldName === "urlType") {
      urlType = content;
    } else if (fieldName === "urlParserStrategy") {
      urlParserStrategy = content;
    } else if (fieldName === "file" || fieldName === "csv") {
      csvText = content;
      if (filenameMatch?.[1]) filename = filenameMatch[1];
    }
  }

  if (!agentId) throw new Error("agentId is required");
  if (!csvText) throw new Error("CSV file is required");
  return { agentId, csvText, filename, importSource, importType, localExtensions, urlType, urlParserStrategy };
}

export { URL_IMPORT_FAIL_MESSAGE };
