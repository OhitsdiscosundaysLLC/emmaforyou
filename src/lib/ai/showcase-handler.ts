import { createServerOnlyFn } from "@tanstack/react-start";
import { showcaseRequestSchema, type ShowcaseKind } from "../showcase";
import { checkLimits, checkOrigin, readJson } from "./guard";
import { verifyPrototype } from "./proto-sign";
import { verifyContent } from "./content-sign";
import { publishShowcaseItem, removeShowcaseItem } from "./showcase-publish";

const bad = (message: string, status = 400) => Response.json({ message }, { status });

/**
 * POST /api/showcase — publish something a visitor made (they chose to). Only signed tool output is accepted; contact
 * details are scrubbed and names removed unless the visitor ticked "show my business name". Items appear at once.
 * DELETE /api/showcase — the visitor removes their own item with the private token they were given.
 */
export const handleShowcase = createServerOnlyFn(async (request: Request) => {
  const origin = checkOrigin(request);
  if (origin) return origin.response;

  if (request.method === "DELETE") {
    const body = await readJson(request, 400);
    if (!body.ok) return body.response;
    const { slug, token } = (body.value ?? {}) as { slug?: string; token?: string };
    if (typeof slug !== "string" || typeof token !== "string") return bad("That link isn't valid.");
    const r = await removeShowcaseItem(slug, token);
    if (r.error) return bad("We couldn't remove it just now. Please try again.", 500);
    if (!r.removed) return bad("We couldn't find that item, or it was already removed.", 404);
    return Response.json({ removed: true });
  }

  const body = await readJson(request, 400000);
  if (!body.ok) return body.response;
  const parsed = showcaseRequestSchema.safeParse(body.value);
  if (!parsed.success) return bad("That item can't be added to the showcase.");
  const v = parsed.data;
  const kind = v.kind as ShowcaseKind;
  const c = v.content as Record<string, unknown>;

  // 1. Only real tool output.
  let ok = false;
  if (kind === "app" || kind === "website") ok = typeof c?.html === "string" && (await verifyPrototype(c.html as string, v.sig));
  else ok = await verifyContent(kind, c, v.sig);
  if (!ok) return bad("Only results made with our free tools on this website can be added to the showcase.");

  const limit = await checkLimits(request, "showcase", { perVisitor: 20, global: 500, label: "showcase items", worksWithoutAi: true });
  if (!limit.ok) return limit.response;

  // 2-4. Privacy-safe item, suitability check, insert (shared with the prototype builder's server-side publish).
  const r = await publishShowcaseItem(request, v);
  if (!r.ok) return bad(r.message, r.status);
  return Response.json({ slug: r.slug, token: r.token, title: r.title, path: r.path }, { headers: { "Cache-Control": "no-store" } });
});
