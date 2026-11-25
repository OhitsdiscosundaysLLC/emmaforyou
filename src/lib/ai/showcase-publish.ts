import { scrub, unsuitable, type ShowcaseRequest } from "../showcase";
import { buildShowcaseItem } from "../showcase-build";
import { adminDb, hashVisitor } from "./guard";
import { visitorSalt } from "./provider";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");
export async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const SLUG_RE = /^[A-Za-z0-9]{10,16}$/;
export const validToken = (t: unknown): t is string => typeof t === "string" && t.length >= 20 && t.length <= 64;

export type PublishResult = { ok: true; slug: string; token: string; title: string; path: string } | { ok: false; status: number; message: string };

/**
 * Publish one piece of (already verified) tool output to the public showcase: build the privacy-safe item,
 * refuse anything unsuitable for a public wall, insert it, and return the visitor's private remove token.
 * Shared by POST /api/showcase (browser publishes) and the prototype builder (the server publishes the
 * moment a prototype finishes, so a visitor who closes the tab early still appears in the showcase).
 */
export async function publishShowcaseItem(request: Request, v: ShowcaseRequest): Promise<PublishResult> {
  const built = buildShowcaseItem(v);
  if ("error" in built) return { ok: false, status: 400, message: built.error };
  if (unsuitable(built.title, built.summary, v.prompt, JSON.stringify(built.payload).slice(0, 20000))) {
    return { ok: false, status: 422, message: "This item can't be shown publicly." };
  }
  const token = rand(24);
  const db = await adminDb();
  const visitor = await hashVisitor(request, visitorSalt());
  for (let i = 0; i < 3; i++) {
    const slug = rand(12);
    const { error } = await db.from("showcase_items").insert({
      slug, kind: v.kind, title: built.title, summary: built.summary, industry: built.industry, place: v.place ? scrub(v.place, { max: 60 }) : null,
      business: built.business, payload: built.payload, lang: v.lang, remove_hash: await sha256(token), visitor_hash: visitor,
    });
    if (!error) return { ok: true, slug, token, title: built.title, path: `/showcase/${slug}` };
    if (!/duplicate|unique/i.test(error.message ?? "")) {
      console.error("[showcase] insert", error.code ?? error.message);
      return { ok: false, status: 500, message: "We couldn't add it to the showcase just now." };
    }
  }
  return { ok: false, status: 500, message: "We couldn't add it to the showcase just now." };
}

/** Remove a visitor's own item with its private token. Returns how many rows went (0 when the token doesn't match). */
export async function removeShowcaseItem(slug: string, token: string): Promise<{ removed: number; error: boolean }> {
  if (!SLUG_RE.test(slug) || !validToken(token)) return { removed: 0, error: false };
  const db = await adminDb();
  const { data, error } = await db.from("showcase_items").delete().eq("slug", slug).eq("remove_hash", await sha256(token)).select("slug");
  return { removed: data?.length ?? 0, error: Boolean(error) };
}
