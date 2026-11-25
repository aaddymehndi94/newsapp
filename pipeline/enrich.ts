import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { allowedByRobots } from "./robots.ts";
import { UA, fetchText, log } from "./util.ts";

export interface PageInfo {
  ok: boolean;
  status: number;
  blockedByRobots?: boolean;
  ogImage?: string;
  ogImageWidth?: number;
  description?: string;
  text?: string;
}

// ───────────── article page reading ─────────────
function meta(doc: Document, ...names: string[]): string | undefined {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    const c = el?.getAttribute("content")?.trim();
    if (c) return c;
  }
  return undefined;
}

export async function readPage(url: string): Promise<PageInfo> {
  if (!(await allowedByRobots(url, { ai: true }))) return { ok: false, status: 0, blockedByRobots: true };
  const r = await fetchText(url, { timeoutMs: 15_000 });
  if (!r.ok || !/html/i.test(r.contentType)) return { ok: false, status: r.status };
  try {
    const { document } = parseHTML(r.text);
    const doc = document as unknown as Document;
    let ogImage = meta(doc, "og:image:secure_url", "og:image", "twitter:image", "twitter:image:src");
    if (ogImage) {
      try {
        ogImage = new URL(ogImage, r.finalUrl).toString();
      } catch {
        ogImage = undefined;
      }
    }
    const ogImageWidth = Number(meta(doc, "og:image:width") ?? 0) || undefined;
    const description = meta(doc, "og:description", "description");
    let text: string | undefined;
    try {
      const art = new Readability(doc, { charThreshold: 400 }).parse();
      text = art?.textContent?.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
    } catch {
      /* readability failed; keep description only */
    }
    if (text && text.length > 14_000) text = text.slice(0, 14_000) + " …";
    return { ok: true, status: r.status, ogImage, ogImageWidth, description, text };
  } catch (e) {
    log(`parse failed ${url}: ${(e as Error).message}`);
    return { ok: false, status: r.status };
  }
}

// ───────────── image probing ─────────────
export interface ImageProbe {
  ok: boolean;
  width?: number;
  height?: number;
  type?: string;
}

/** Fetch the first bytes of an image (no Referer, like the reader's browser) and read its size. */
export async function probeImage(url: string): Promise<ImageProbe> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*;q=0.8", range: "bytes=0-131071" },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!(res.ok || res.status === 206) || !type.startsWith("image/")) {
      res.body?.cancel().catch(() => undefined);
      return { ok: false, type };
    }
    const buf = new Uint8Array(await res.arrayBuffer()).subarray(0, 131072);
    return { ok: true, type, ...imageSize(buf) };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

export function imageSize(b: Uint8Array): { width?: number; height?: number } {
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b.length > 24) {
    const dv = new DataView(b.buffer, b.byteOffset);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
  // WebP
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8 ") return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  // JPEG: walk segments to SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return {};
}
