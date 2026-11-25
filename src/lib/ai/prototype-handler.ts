import { createServerOnlyFn } from "@tanstack/react-start";
import { cleanGeneratedHtml, prototypeRequestSchema, type PrototypeRequest } from "../prototype";
import { createResponsesCall } from "./responses";
import { getLovableAiGatewayResponseHeaders } from "./run-id.ts";
import { aiProvider, classifyFailure, visitorSalt, type ProviderFailure } from "./provider";
import { signPrototype } from "./proto-sign";
import { buildInstructions, buildUserMessage } from "./prototype-prompts";
import { adminDb, memoryLimit, memoryRecord } from "./guard";
import { publishShowcaseItem, removeShowcaseItem } from "./showcase-publish";

export const handlePrototype = createServerOnlyFn(async (request: Request) => {
  const origin = request.headers.get("origin");
  const host = new URL(request.url).host;
  if (!origin || new URL(origin).host !== host || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ message: "Please create your prototype from the EmmaForYou website." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 170000) {
    return Response.json({ message: "This prototype is too large to refine." }, { status: 413 });
  }
  let input: PrototypeRequest;
  try {
    const raw = await request.text();
    if (raw.length > 170000) return Response.json({ message: "This prototype is too large to refine." }, { status: 413 });
    input = prototypeRequestSchema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ message: "Describe your idea in 8–500 characters (and plan your app's screens first)." }, { status: 400 });
  }
  const provider = aiProvider();
  if (!provider) return Response.json({ message: "The prototype builder isn't available right now. Please chat with us on WhatsApp." }, { status: 503 });
  // Only trusted same-origin generation requests can reach private circuit-breaker state.
  // adminDb() degrades to an "unavailable" stand-in when the database can't be used; limits then fall back to memory.
  const supabaseAdmin = await adminDb();
  const { data: blocked, error: stateError } = await supabaseAdmin.from("prototype_ai_access_state").select("status,message,updated_at").eq("id", provider.pauseId).maybeSingle();
  // A credit/access failure pauses generation for a while, then retries on its own (e.g. after credits are topped up).
  if (blocked && Date.now() - new Date(blocked.updated_at).getTime() < BLOCK_COOLDOWN_MS) {
    return Response.json({ message: "The prototype builder is taking a short break. Please try again later, or chat with us on WhatsApp." }, { status: 503 });
  }

  // Visitor limit: a few generations per visitor per hour, plus an overall hourly cap to protect the AI budget.
  const visitorHash = await hashVisitor(request, visitorSalt());
  // Automatic repairs (the preview reported a script error) have their own small allowance, so a glitch
  // doesn't use up the visitor's prototypes.
  // New builds, refinements and automatic repairs each have their own allowance, so a visitor can keep
  // improving a prototype without using up their new builds.
  const kinds = input.repair ? ["repair"] : input.refinement ? ["refine"] : ["new"];
  const perVisitor = input.repair ? REPAIRS_PER_VISITOR_PER_HOUR : input.refinement ? REFINES_PER_VISITOR_PER_HOUR : PER_VISITOR_PER_HOUR;
  const globalCap = input.refinement && !input.repair ? GLOBAL_REFINES_PER_HOUR : GLOBAL_PER_HOUR;
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const [{ data: mine, error: mineError }, { count: everyone, error: allError }] = await Promise.all([
    // Only prototype runs count here; other tools log their own kinds in the same table.
    supabaseAdmin.from("prototype_generations").select("created_at").eq("visitor_hash", visitorHash).in("kind", kinds).gte("created_at", since).order("created_at", { ascending: true }),
    supabaseAdmin.from("prototype_generations").select("id", { count: "exact", head: true }).in("kind", kinds).gte("created_at", since),
  ]);
  const dbDown = Boolean(stateError || mineError || allError);
  const mem = dbDown ? memoryLimit(`proto:${kinds.join("+")}`, visitorHash, perVisitor, globalCap) : null;
  const usedCount = mem ? mem.used : (mine?.length ?? 0);
  const totalCount = mem ? mem.total * 2 : (everyone ?? 0);
  if (usedCount >= perVisitor) {
    const oldest = mem ? (mem.oldest ?? Date.now()) : new Date(mine![0].created_at).getTime();
    const minutes = Math.max(1, Math.ceil((oldest + HOUR_MS - Date.now()) / 60000));
    return Response.json(
      { message: input.repair ? "We couldn't fix this prototype automatically right now. Try Regenerate, or chat with us on WhatsApp." : input.refinement ? `You've made ${REFINES_PER_VISITOR_PER_HOUR} changes this hour. You can make more in about ${minutes} minute${minutes === 1 ? "" : "s"}, or chat with us on WhatsApp and we'll build the real thing.` : `You've used your ${PER_VISITOR_PER_HOUR} free prototypes for this hour. You can create more in about ${minutes} minute${minutes === 1 ? "" : "s"} — or chat with us on WhatsApp and we'll build the real thing.`, retryAfterMinutes: minutes },
      { status: 429, headers: { "Retry-After": String(minutes * 60) } },
    );
  }
  if (totalCount >= globalCap) {
    return Response.json({ message: "The prototype builder is very busy right now. Please try again in a little while." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  memoryRecord(`proto:${kinds.join("+")}`, visitorHash);
  const { data: logged } = dbDown ? { data: null } : await supabaseAdmin.from("prototype_generations").insert({ visitor_hash: visitorHash, kind: input.repair ? "repair" : input.refinement ? "refine" : "new" }).select("id").maybeSingle();
  const remaining = input.repair || input.refinement ? -1 : PER_VISITOR_PER_HOUR - usedCount - 1;

  let notifyReady: (response: Response | null) => void = () => {};
  const ready = new Promise<Response | null>((resolve) => { notifyReady = resolve; });
  let upstreamFailure = "";
  let failure: ProviderFailure | null = null;
  const call = createResponsesCall(request, {
    provider, model: provider.creativeModel,
    // New builds get more thinking time for layout and design; edits and repairs stay fast.
    reasoningEffort: input.refinement ? "low" : "medium",
    timeoutMs: 280000,
    onResponse: async (response) => {
      if (!response.ok) {
        failure = await classifyFailure(provider, response);
        upstreamFailure = failure.message;
        if (failure.pause) {
          await supabaseAdmin.from("prototype_ai_access_state").upsert({ id: provider.pauseId, status: response.status, message: `${provider.id} ${response.status}`, updated_at: new Date().toISOString() });
        }
      }
      notifyReady(response);
    },
  }, [{ role: "user", content: buildUserMessage(input) }], buildInstructions(input));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: object) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        let hasText = false;
        let full = "";
        for await (const part of call.result.fullStream) {
          if (part.type === "text-delta") { hasText = true; full += part.text; send({ type: "text", text: part.text }); }
          if (part.type === "reasoning-delta") send({ type: "reasoning", text: part.text });
          if (part.type === "error") {
            notifyReady(null);
            send({ type: "error", message: upstreamFailure || "Your prototype could not be completed. Please try again later." });
          }
          if (part.type === "finish") {
            if (part.finishReason === "content-filter") send({ type: "error", message: "This request was declined by the AI service." });
            else if (!hasText) send({ type: "error", message: "The AI service returned no prototype." });
            // The signature lets the visitor save/share exactly this HTML later (see /api/prototype-share).
            else {
              const sig = await signPrototype(full);
              const showcase = await autoPublish(request, input, full, sig);
              send({ type: "done", sig, ...(showcase ? { showcase } : {}) });
            }
          }
        }
      } catch (error) {
        notifyReady(null);
        if (!request.signal.aborted) send({ type: "error", message: upstreamFailure || "Generation was interrupted. Your previous preview is safe." });
      } finally { notifyReady(null); controller.close(); }
    },
  });
  const upstream = await ready;
  if (upstream && !upstream.ok) {
    // Nothing was generated, so the attempt doesn't count against the visitor's limit.
    if (logged?.id) await supabaseAdmin.from("prototype_generations").delete().eq("id", logged.id);
    const f = failure as ProviderFailure | null;
    return Response.json({ message: upstreamFailure || "AI generation is temporarily unavailable." }, { status: f?.status ?? 502 });
  }
  if (request.signal.aborted) return new Response(null, { status: 499 });
  const base: Record<string, string> = { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", ...(remaining >= 0 ? { "X-Prototypes-Remaining": String(remaining) } : {}) };
  const headers = provider.id === "openai" ? new Headers(base) : getLovableAiGatewayResponseHeaders(upstream?.headers, base);
  return new Response(stream, { headers });
});

/** Closing tags that show the model finished a usable document (same check as the builder). */
const COMPLETE_MARKUP = /<\/(html|body|main|section|div)>\s*$/i;

/**
 * Publish a finished prototype to the public showcase from the server, unless the visitor unticked it. Runs for
 * new builds, refinements and repairs alike; when the visitor sends the previous item's private link, that item is
 * removed once the new version is live, so the showcase always holds the latest working version. Best effort:
 * a showcase problem never fails the build.
 */
async function autoPublish(request: Request, input: PrototypeRequest, full: string, sig: string): Promise<{ slug: string; token: string; title: string; replaced: string | null } | null> {
  const choice = input.showcase;
  if (!choice?.show) return null;
  try {
    const html = cleanGeneratedHtml(full);
    if (!COMPLETE_MARKUP.test(html)) return null;
    const r = await publishShowcaseItem(request, {
      kind: input.kind, sig, prompt: input.prompt, lang: input.language,
      content: { html, plan: input.plan, pages: input.pages, platform: choice.platform ?? "ios" },
      showBusiness: Boolean(choice.showBusiness && choice.business), business: choice.business, showSite: false,
    });
    if (!r.ok) return null;
    let replaced: string | null = null;
    if (choice.replace) {
      const gone = await removeShowcaseItem(choice.replace.slug, choice.replace.token);
      if (gone.removed) replaced = choice.replace.slug;
    }
    return { slug: r.slug, token: r.token, title: r.title, replaced };
  } catch (e) {
    console.error("[prototype] showcase publish", e instanceof Error ? e.message : e);
    return null;
  }
}

const HOUR_MS = 60 * 60 * 1000;
const PER_VISITOR_PER_HOUR = 3;
const REPAIRS_PER_VISITOR_PER_HOUR = 3;
const REFINES_PER_VISITOR_PER_HOUR = 10;
const GLOBAL_REFINES_PER_HOUR = 200;
const GLOBAL_PER_HOUR = 60;
const BLOCK_COOLDOWN_MS = 30 * 60 * 1000;

/** One-way hash of the visitor's network address and browser, salted with a server secret. Raw IPs are never stored. */
async function hashVisitor(request: Request, secret: string): Promise<string> {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const agent = (request.headers.get("user-agent") || "").slice(0, 200);
  const data = new TextEncoder().encode(`${secret.slice(0, 16)}|${ip}|${agent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}