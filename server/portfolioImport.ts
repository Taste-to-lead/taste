import type { Request } from "express";
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
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`);
  const html = await response.text();
  const listings = extractListingsFromHtml(url, html);
  if (listings.length < 3) {
    throw new Error(URL_IMPORT_FAIL_MESSAGE);
  }
  return listings;
}

export async function runPortfolioImportJob(
  jobId: string,
  agentId: string,
  sourceListings: ImportedListing[]
): Promise<void> {
  let processed = 0;
  let succeeded = 0;
  let failedCount = 0;

  await storage.updateImportJob(jobId, {
    status: "running",
    total: sourceListings.length,
    processed: 0,
    succeeded: 0,
    failedCount: 0,
    error: null,
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
      await storage.updateImportJob(jobId, {
        processed,
        succeeded,
        failedCount,
      });
    }
  }

  await storage.updateImportJob(jobId, {
    status: failedCount === sourceListings.length ? "failed" : "done",
    processed,
    succeeded,
    failedCount,
    error: failedCount === sourceListings.length ? "All listings failed to import." : null,
  });
}

export async function parseCsvMultipart(req: Request): Promise<{ agentId: string; csvText: string; filename: string }> {
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
    } else if (fieldName === "file" || fieldName === "csv") {
      csvText = content;
      if (filenameMatch?.[1]) filename = filenameMatch[1];
    }
  }

  if (!agentId) throw new Error("agentId is required");
  if (!csvText) throw new Error("CSV file is required");
  return { agentId, csvText, filename };
}

export { URL_IMPORT_FAIL_MESSAGE };
