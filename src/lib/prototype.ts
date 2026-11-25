import { z } from "zod";
import { TIERS } from "./pricing-data";

/* ───────────────────────── Requests ───────────────────────── */

export const PROTO_LANGS = ["en", "fr", "es", "de"] as const;
export type ProtoKind = "website" | "app";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const short = (n: number) => z.string().trim().max(n);

/** One screen of an app prototype, as planned (and edited by the visitor) before building. */
export const appScreenSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9-]{0,23}$/),
  name: z.string().trim().min(1).max(28),
  purpose: short(160),
  tab: z.boolean().default(true),
});

export const protoPlanSchema = z.object({
  name: z.string().trim().min(1).max(40),
  tagline: short(90).default(""),
  primary: hex,
  accent: hex,
  screens: z.array(appScreenSchema).min(2).max(7),
  features: z.array(z.string().trim().min(1).max(140)).max(10).default([]),
  sample: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
});
export type ProtoPlan = z.infer<typeof protoPlanSchema>;
export type AppScreen = z.infer<typeof appScreenSchema>;

/** Website pages a visitor can ask for. */
export const WEBSITE_PAGES = ["Home", "Services", "About", "Pricing", "Shop", "Booking", "Gallery", "Blog", "FAQ", "Contact"] as const;
export const DEFAULT_PAGES = ["Home", "Services", "About", "Contact"];

export const brandSchema = z.object({
  name: short(60).optional(),
  color: hex.optional(),
  hasLogo: z.boolean().optional(),
});

/** Design directions a visitor can pick for a prototype (passed to the generator as art direction). */
export const DESIGN_STYLES = [
  { id: "modern", label: "Clean & modern", brief: "clean, modern and airy: generous white space, a crisp sans-serif type scale, subtle shadows, one strong accent colour" },
  { id: "bold", label: "Bold & vibrant", brief: "bold and energetic: oversized headlines, saturated colour blocks and gradients, high contrast, punchy buttons" },
  { id: "luxury", label: "Luxury & elegant", brief: "premium and elegant: dark or cream backgrounds, refined serif display type paired with a clean sans-serif, thin rules, restrained gold or metallic accents, slow subtle motion" },
  { id: "friendly", label: "Warm & friendly", brief: "warm and approachable: soft rounded shapes, warm palette, friendly illustrations drawn in inline SVG, conversational copy" },
  { id: "corporate", label: "Professional & trusted", brief: "professional and trustworthy: structured grid, navy/neutral palette, clear data and credentials areas, conservative typography" },
  { id: "playful", label: "Playful & creative", brief: "playful and creative: expressive colours, rotated stickers and badges, hand-drawn style SVG doodles, lively micro-interactions" },
] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number]["id"];
const STYLE_IDS = DESIGN_STYLES.map((d) => d.id) as [DesignStyle, ...DesignStyle[]];

export const prototypeRequestSchema = z.object({
  kind: z.enum(["website", "app"]).default("website"),
  prompt: z.string().trim().min(8).max(500),
  refinement: z.string().trim().max(500).optional(),
  html: z.string().max(160000).optional(),
  language: z.enum(PROTO_LANGS).default("en"),
  plan: protoPlanSchema.optional(),
  pages: z.array(z.enum(WEBSITE_PAGES)).min(1).max(7).optional(),
  brand: brandSchema.optional(),
  /** Art direction picked by the visitor (see DESIGN_STYLES). */
  style: z.enum(STYLE_IDS).optional(),
  /** Automatic fix after the preview reported a script error (refinement = the error message). */
  repair: z.boolean().optional(),
  /**
   * "Select to edit": the element the visitor picked in the preview (its tag path and a trimmed copy of its markup),
   * so the change is applied to that part only.
   */
  target: z.object({ path: z.string().trim().max(300), html: z.string().max(4000) }).optional(),
  /**
   * Public showcase choice. The server publishes the finished prototype itself (so it appears even if the visitor
   * closes the tab); `replace` is the visitor's previous item for this prototype, removed once the new one is live.
   */
  showcase: z.object({
    show: z.boolean(),
    showBusiness: z.boolean().default(false),
    business: z.string().trim().max(80).optional(),
    platform: z.enum(["ios", "android"]).optional(),
    replace: z.object({ slug: z.string().regex(/^[A-Za-z0-9]{10,16}$/), token: z.string().min(20).max(64) }).optional(),
  }).optional(),
}).refine((value) => !value.refinement || Boolean(value.html), { message: "A refinement needs an existing prototype." })
  .refine((value) => value.kind !== "app" || Boolean(value.plan) || Boolean(value.refinement), { message: "An app needs a plan." });
export type PrototypeRequest = z.infer<typeof prototypeRequestSchema>;

export const planRequestSchema = z.object({
  kind: z.enum(["website", "app"]).default("app"),
  idea: z.string().trim().min(8).max(500),
  business: short(60).optional(),
  color: hex.optional(),
  language: z.enum(PROTO_LANGS).default("en"),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const shareRequestSchema = z.object({
  kind: z.enum(["website", "app"]),
  prompt: z.string().trim().min(8).max(500),
  html: z.string().min(50).max(160000),
  sig: z.string().regex(/^[a-f0-9]{64}$/),
  plan: protoPlanSchema.optional(),
  pages: z.array(z.enum(WEBSITE_PAGES)).max(7).optional(),
  logo: z.string().max(200000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
  platform: z.enum(["ios", "android"]).optional(),
  name: z.string().trim().min(1).max(100),
  business: short(120).optional(),
  email: z.string().trim().max(200).email().optional().or(z.literal("")),
  whatsapp: z.string().trim().regex(/^\+?[0-9 ()-]{7,22}$/).optional().or(z.literal("")),
  consent: z.literal(true),
}).refine((v) => Boolean(v.email) || Boolean(v.whatsapp), { message: "Add a WhatsApp number or an email." });
export type ShareRequest = z.infer<typeof shareRequestSchema>;

/* ───────────────────────── Preview documents ───────────────────────── */

const CSP =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'">`;
const VIEWPORT = `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`;
/** Tells the builder (parent page) when a generated script fails, so it can repair the prototype once. */
const REPORTER = `<script>addEventListener("error",function(e){try{parent.postMessage({efyProtoError:String(e.message||"Script error").slice(0,300)+(e.lineno?" (line "+e.lineno+")":"")},"*")}catch(_){}});</script>`;

/**
 * "Point and change": dormant until the builder posts {efyPick:true}. Then hovering outlines an element and a click
 * reports its path and (trimmed) markup to the parent with {efyPicked}; Escape or {efyPick:false} cancels. It only
 * ever calls parent.postMessage, so the sandbox and CSP stay as strict as before.
 */
const PICKER = `<script>(function(){var on=false,box=null,cur=null;function path(el){var p=[];while(el&&el.nodeType===1&&el.tagName!=="BODY"&&p.length<5){var s=el.tagName.toLowerCase();if(el.id)s+="#"+el.id;else if(el.classList.length)s+="."+[].slice.call(el.classList,0,2).join(".");var sib=el.parentElement?[].filter.call(el.parentElement.children,function(c){return c.tagName===el.tagName}):[];if(sib.length>1)s+=":nth-of-type("+(sib.indexOf(el)+1)+")";p.unshift(s);el=el.parentElement}return p.join(" > ")}function show(el){if(!box){box=document.createElement("div");box.setAttribute("data-efy-pick","");box.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6d5bff;background:rgba(109,91,255,.12);border-radius:6px;transition:all .08s"}if(!box.parentNode)document.documentElement.appendChild(box);var r=el.getBoundingClientRect();box.style.left=r.left+"px";box.style.top=r.top+"px";box.style.width=r.width+"px";box.style.height=r.height+"px"}function stop(){on=false;cur=null;if(box&&box.parentNode)box.parentNode.removeChild(box);document.documentElement.style.cursor=""}addEventListener("message",function(e){var d=e.data||{};if(typeof d.efyPick==="boolean"){if(d.efyPick){on=true;document.documentElement.style.cursor="crosshair"}else stop()}});addEventListener("mouseover",function(e){if(!on)return;cur=e.target;show(cur)},true);addEventListener("click",function(e){if(!on)return;e.preventDefault();e.stopPropagation();var el=e.target;if(!el||el.nodeType!==1)return;var h=el.outerHTML||"";try{parent.postMessage({efyPicked:{path:path(el).slice(0,300),html:h.length>4000?h.slice(0,4000)+"…":h,label:(el.innerText||el.getAttribute("aria-label")||el.tagName).trim().replace(/\\s+/g," ").slice(0,80)}},"*")}catch(_){}stop()},true);addEventListener("keydown",function(e){if(on&&e.key==="Escape"){stop();try{parent.postMessage({efyPicked:null},"*")}catch(_){}}},true)})();</script>`;

/** Strip stray markdown fences the model may add around its HTML. */
export function cleanGeneratedHtml(html: string): string {
  return html.replace(/^\s*```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Put the visitor's logo into the placeholders the generator writes (`data-efy-logo`). Only data: images. */
export function applyLogo(html: string, logo?: string | null): string {
  if (!logo || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) return html;
  const script = `<script>(function(){var s=${JSON.stringify(logo)};document.querySelectorAll('[data-efy-logo]').forEach(function(el){var i=document.createElement('img');i.src=s;i.alt=(el.textContent||'Logo').trim();i.style.cssText='height:1.6em;width:auto;max-width:9em;object-fit:contain;vertical-align:middle;display:inline-block';el.textContent='';el.appendChild(i);});})();</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${script}</body>`) : `${html}${script}`;
}

/**
 * Wrap generated markup so the restrictive CSP is always the very first thing in <head>,
 * whether the model returned a full document or just a fragment.
 */
export function previewDocument(html: string, logo?: string | null): string {
  const clean = applyLogo(cleanGeneratedHtml(html), logo);
  if (/<head[\s>]/i.test(clean)) {
    const withCsp = clean.replace(/<head([^>]*)>/i, `<head$1>${CSP}${REPORTER}${PICKER}`);
    return /name=["']viewport["']/i.test(withCsp) ? withCsp : withCsp.replace(CSP, `${CSP}${VIEWPORT}`);
  }
  if (/<html[\s>]/i.test(clean)) {
    return clean.replace(/<html([^>]*)>/i, `<html$1><head>${CSP}${REPORTER}${PICKER}${VIEWPORT}</head>`);
  }
  return `<!doctype html><html><head>${CSP}${REPORTER}${PICKER}${VIEWPORT}</head><body>${clean}</body></html>`;
}

/* ───────────────────────── Plans without AI ───────────────────────── */

type Template = { test: RegExp; tagline: string; primary: string; accent: string; screens: [string, string, string][]; features: string[]; sample: string[] };

const s = (id: string, name: string, purpose: string): [string, string, string] => [id, name, purpose];

/** Rule-based starting plans, used when the AI is paused and as a guide for the AI. Order matters: first match wins. */
const TEMPLATES: Template[] = [
  { test: /\b(?:deliver|food|restaurant|kitchen|order|menu|chop|meal|pizza|cafe|bakery)/i, tagline: "Order your favourites in a few taps", primary: "#e85d2a", accent: "#ffb347",
    screens: [s("home", "Home", "Featured dishes, categories and offers"), s("menu", "Menu", "Search and filter the full menu, add items to the cart"), s("cart", "Cart", "Change quantities, see totals and delivery fee, place a demo order"), s("orders", "Orders", "Order status timeline for placed demo orders"), s("profile", "Profile", "Addresses, favourites and settings")],
    features: ["Add to cart with live totals", "Search and category filters", "Order tracking timeline", "Favourites"], sample: ["8–12 dishes with prices", "3 categories", "Delivery fee"] },
  { test: /\b(?:salon|spa|barber|beauty|nail|clinic|doctor|dental|appointment|booking|book|therapy|massage)/i, tagline: "Book your next appointment in seconds", primary: "#7b4dff", accent: "#ff7eb6",
    screens: [s("home", "Home", "Welcome, next appointment, popular services"), s("services", "Services", "Service list with prices and durations"), s("book", "Book", "Pick a service, staff, date and time slot, confirm a demo booking"), s("bookings", "Bookings", "Upcoming and past bookings, cancel or reschedule"), s("profile", "Profile", "Details, loyalty points and reminders")],
    features: ["Pick date and time slots", "Bookings list that updates", "Cancel or reschedule", "Loyalty points"], sample: ["6–8 services with prices", "3 staff members", "Opening hours"] },
  { test: /\b(?:shop|store|fashion|boutique|ecommerce|e-commerce|sell|product|cloth|shoe|cosmetic)/i, tagline: "Shop the latest collection", primary: "#111827", accent: "#f59e0b",
    screens: [s("home", "Home", "Hero banner, new arrivals, categories"), s("shop", "Shop", "Product grid with search, filters and sorting"), s("product", "Product", "Product details, size/colour options, add to cart"), s("cart", "Cart", "Quantities, totals, demo checkout"), s("account", "Account", "Orders, wishlist and addresses")],
    features: ["Product filters and search", "Size and colour options", "Cart and demo checkout", "Wishlist"], sample: ["10–12 products with prices", "4 categories", "Sizes and colours"] },
  { test: /\b(?:school|student|learn|course|class|tutor|academy|education|lesson)/i, tagline: "Learning, organised", primary: "#2563eb", accent: "#22c55e",
    screens: [s("home", "Home", "Today's classes, announcements and progress"), s("courses", "Courses", "Course list with progress and lessons"), s("lesson", "Lesson", "Lesson content with a short quiz"), s("schedule", "Timetable", "Weekly timetable and assignments with due dates"), s("profile", "Profile", "Grades, attendance and messages")],
    features: ["Course progress bars", "Quiz with instant score", "Assignments checklist", "Announcements"], sample: ["4 courses", "Weekly timetable", "3 assignments"] },
  { test: /\b(?:gym|fitness|workout|trainer|yoga|health|diet|run)/i, tagline: "Train smarter every day", primary: "#0f766e", accent: "#a3e635",
    screens: [s("home", "Today", "Today's workout, streak and stats"), s("workouts", "Workouts", "Workout library with filters"), s("session", "Session", "Exercise steps with a timer and sets checklist"), s("progress", "Progress", "Charts of weight and workouts over time"), s("profile", "Profile", "Membership, goals and settings")],
    features: ["Workout timer", "Sets checklist", "Progress chart", "Streak counter"], sample: ["8 workouts", "4 weeks of progress", "Membership plan"] },
  { test: /\b(?:church|ministry|mosque|faith|sermon|prayer|devotion)/i, tagline: "Stay connected with your community", primary: "#7c2d12", accent: "#fbbf24",
    screens: [s("home", "Home", "Upcoming service, daily verse and announcements"), s("sermons", "Sermons", "Sermon list with a player screen"), s("events", "Events", "Events calendar with RSVP"), s("give", "Give", "Demo giving form with amount presets"), s("prayer", "Prayer", "Prayer requests list and form")],
    features: ["RSVP to events", "Prayer request wall", "Demo giving form", "Sermon player screen"], sample: ["5 sermons", "4 events", "Service times"] },
  { test: /\b(?:bank|wallet|fintech|pay|saving|loan|money|finance|invest|crypto|budget)/i, tagline: "Your money, made simple", primary: "#0b5d4b", accent: "#38bdf8",
    screens: [s("home", "Home", "Balance, quick actions and recent transactions"), s("send", "Send", "Send money to a contact with a confirmation step (demo)"), s("activity", "Activity", "Transaction history with filters"), s("savings", "Savings", "Savings goals with progress"), s("profile", "Profile", "Cards, limits and security settings")],
    features: ["Balance and transactions", "Send money flow (demo)", "Savings goals", "Spending by category"], sample: ["20 transactions", "3 savings goals", "2 cards"] },
  { test: /\b(?:real estate|property|apartment|house|rent|estate|realtor|hotel|stay|shortlet)/i, tagline: "Find your next place", primary: "#1e3a8a", accent: "#f97316",
    screens: [s("home", "Explore", "Featured listings and search"), s("listings", "Listings", "Listings with filters for price, beds and area"), s("listing", "Details", "Photos (illustrated), features, map placeholder, book a viewing"), s("saved", "Saved", "Saved listings"), s("profile", "Profile", "Viewings and messages")],
    features: ["Filters for price and bedrooms", "Save listings", "Book a viewing", "Mortgage or rent calculator"], sample: ["8 listings with prices", "3 areas", "Agent details"] },
  { test: /\b(?:event|ticket|concert|party|wedding|conference)/i, tagline: "Never miss a moment", primary: "#9d174d", accent: "#fde047",
    screens: [s("home", "Home", "Featured events"), s("events", "Events", "Events list with date and category filters"), s("event", "Event", "Details, ticket types and quantity"), s("tickets", "Tickets", "My demo tickets with a QR-style pass"), s("profile", "Profile", "Settings and favourites")],
    features: ["Ticket type picker", "Demo ticket pass", "Filters by date", "Favourites"], sample: ["6 events", "3 ticket types"] },
];

const GENERIC: Template = { test: /.*/, tagline: "Everything your customers need, in one app", primary: "#6d5bff", accent: "#3dd6f5",
  screens: [s("home", "Home", "Welcome, highlights and quick actions"), s("services", "Services", "What the business offers, with prices"), s("request", "Request", "A request or booking form with confirmation"), s("updates", "Updates", "News, offers and notifications"), s("profile", "Profile", "Account details and settings")],
  features: ["Request form with confirmation", "Searchable list", "Notifications list", "Profile settings"], sample: ["6 services", "3 updates"] };

function titleCase(t: string) { return t.replace(/\s+/g, " ").trim().split(" ").slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); }

export function guessName(idea: string, business?: string): string {
  if (business?.trim()) return business.trim().slice(0, 40);
  const quoted = idea.match(/["“']([^"”']{2,30})["”']/);
  if (quoted) return quoted[1].trim();
  const called = idea.match(/(?:called|named)\s+([A-Z][\w&' -]{1,28})/);
  if (called) return called[1].trim();
  const t = TEMPLATES.find((x) => x.test.test(idea));
  const word = t ? (idea.match(t.test)?.[0] ?? "") : "";
  return word ? `${titleCase(word)} App` : "My App";
}

/** A sensible plan without AI. */
export function fallbackPlan(req: Pick<PlanRequest, "idea" | "business" | "color">): ProtoPlan {
  const t = TEMPLATES.find((x) => x.test.test(req.idea)) ?? GENERIC;
  return {
    name: guessName(req.idea, req.business),
    tagline: t.tagline,
    primary: req.color ?? t.primary,
    accent: t.accent,
    screens: t.screens.map(([id, name, purpose]) => ({ id, name, purpose, tab: true })),
    features: t.features,
    sample: t.sample,
  };
}

/** Make an AI plan safe and usable: valid ids, unique, 2–6 screens, colours, sensible lengths. */
export function normalisePlan(raw: unknown, req: Pick<PlanRequest, "idea" | "business" | "color">): ProtoPlan {
  const base = fallbackPlan(req);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const col = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const seen = new Set<string>();
  const screens: AppScreen[] = (Array.isArray(r.screens) ? r.screens : []).slice(0, 6).map((x: unknown, i: number) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const name = str(o.name, 28) || `Screen ${i + 1}`;
    let id = str(o.id || name, 24).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^a-z]+/, "") || `screen-${i + 1}`;
    id = id.slice(0, 24);
    while (seen.has(id)) id = `${id.slice(0, 20)}-${i + 1}`;
    seen.add(id);
    return { id, name, purpose: str(o.purpose, 160), tab: o.tab !== false };
  });
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, n);
  return {
    name: str(r.name, 40) || base.name,
    tagline: str(r.tagline, 90) || base.tagline,
    primary: req.color ?? col(r.primary, base.primary),
    accent: col(r.accent, base.accent),
    screens: screens.length >= 2 ? screens : base.screens,
    features: list(r.features, 8, 140).length ? list(r.features, 8, 140) : base.features,
    sample: list(r.sample, 6, 80).length ? list(r.sample, 6, 80) : base.sample,
  };
}

/* ───────────────────────── "Make it real" ───────────────────────── */

export interface PlanSuggestion {
  tier: string;
  price: string;
  why: string;
  includes: string[];
}

const money = (n: number) => `$${n.toLocaleString("en-US")}/mo`;

/**
 * Which published plan fits what the visitor built. Only uses TIERS from pricing-data (never invented prices):
 * a custom website is included from Pro; custom app development is in Enterprise (custom quote).
 */
export function suggestPlan(kind: ProtoKind, opts: { screens?: number; pages?: string[] } = {}): PlanSuggestion {
  const find = (name: string) => TIERS.find((t) => t.name === name)!;
  if (kind === "app") {
    const t = find("Enterprise");
    return { tier: t.name, price: "Custom quote", why: `Custom app development is part of our ${t.name} plan. We'll scope your ${opts.screens ?? 5}-screen app with you on a free call and quote it.`, includes: t.features.filter((f) => !/\+$/.test(f)).slice(0, 4) };
  }
  const t = find("Pro");
  const extras = (opts.pages ?? []).filter((p) => p === "Shop" || p === "Booking");
  return { tier: t.name, price: money(t.monthly), why: `A custom website${extras.length ? ` with ${extras.join(" and ").toLowerCase()}` : ""} is included in our ${t.name} plan, together with ads, an AI chatbot and weekly strategy calls.`, includes: t.features.filter((f) => !/\+$/.test(f)).slice(0, 4) };
}

/** Lowest published monthly price, for "starting from" lines. */
export function startingPrice(): string {
  const prices = TIERS.filter((t) => t.monthly > 0).map((t) => t.monthly);
  return money(Math.min(...prices));
}
