/**
 * Ask Emma's knowledge: every source the assistant may answer from, and the retrieval that picks the few most
 * relevant ones for each question (benchmarked on Intercom Fin / HubSpot customer agent: answer only from approved
 * content, use several sources, cite them). Pure apart from the blog rows passed in, so it is unit-tested
 * (tests/assistant). Sources are the site's own data: FAQ, service Q&A, plans, guides, tools (site-search),
 * every page in the catalogue (page-index), client work (portfolio-data, owner's records) and published blog posts.
 */
import { docs as siteDocs, stem, SYN, terms } from "./site-search";
import { pageIndex } from "./page-index";
import { PROJECTS, FEATURED, projectSlug } from "./portfolio-data";

export type SourceKind = "Answer" | "Service" | "Guide" | "Pricing" | "Tool" | "Page" | "Work" | "Article";
export interface Source { id: string; kind: SourceKind; title: string; text: string; href: string }
export interface BlogRow { slug: string; title: string; excerpt: string; category?: string | null }

let BASE: Source[] | null = null;

/** Site sources (built once per server instance). */
export function baseSources(): Source[] {
  if (BASE) return BASE;
  const out: Source[] = [];
  const seen = new Set<string>();
  const add = (s: Omit<Source, "id">) => {
    const key = `${s.href}|${s.title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...s, id: `s${out.length + 1}` });
  };
  for (const d of siteDocs()) add({ kind: d.kind, title: d.title, text: d.answer, href: d.href });
  for (const p of pageIndex()) {
    if (p.kind === "Account") continue;
    add({ kind: p.kind === "Work" ? "Work" : p.kind === "Tool" ? "Tool" : p.kind === "Service" || p.kind === "Expertise" ? "Service" : p.kind === "Guide" ? "Guide" : "Page", title: p.title, text: [p.hint, p.keywords].filter(Boolean).join(". "), href: p.href });
  }
  // Client work: the owner's records, verbatim (outcomes included). Never paraphrased into new claims.
  const featured = new Map(FEATURED.map((f) => [f.client, f]));
  for (const p of PROJECTS) {
    const f = featured.get(p.name);
    add({ kind: "Work", title: `Client project: ${p.name}`, text: `${p.desc}${f ? ` ${f.niche}.` : ""} Outcome recorded by EmmaForYou: ${p.outcome}. Category: ${p.category}.`, href: `/portfolio/${projectSlug(p.name)}` });
  }
  BASE = out;
  return out;
}

export function articleSources(rows: BlogRow[]): Source[] {
  return rows.slice(0, 200).map((r, i) => ({ id: `a${i + 1}`, kind: "Article" as const, title: r.title, text: `${r.excerpt}${r.category ? ` (${r.category})` : ""}`, href: `/blog/${r.slug}` }));
}

/**
 * Pick the most relevant sources for a question: BM25-style scoring over title and text with the site-search
 * synonyms, a boost for the page the visitor is on, and at most two sources per page so answers draw on several.
 */
export function retrieve(query: string, pool: Source[], opts: { page?: string; limit?: number } = {}): Source[] {
  const limit = opts.limit ?? 8;
  const q = terms(query);
  const page = (opts.page ?? "").split(/[?#]/)[0];
  const onPage = page && page !== "/" ? pool.filter((s) => s.href === page).slice(0, 2) : [];
  if (!q.length) return onPage;
  const expanded = new Map<string, number>();
  for (const t of q) {
    expanded.set(t, 1);
    for (const syn of SYN[t] || []) if (!expanded.has(stem(syn))) expanded.set(stem(syn), 0.45);
  }
  const indexed = pool.map((s) => ({ s, title: new Set(terms(s.title)), body: new Set(terms(s.text)) }));
  const df = new Map<string, number>();
  for (const { title, body } of indexed) for (const t of expanded.keys()) if (title.has(t) || body.has(t)) df.set(t, (df.get(t) || 0) + 1);
  const N = pool.length || 1;
  const scored = indexed.map(({ s, title, body }) => {
    let score = 0, matched = 0;
    for (const [t, w] of expanded) {
      const idf = Math.log(1 + N / (1 + (df.get(t) || 0)));
      if (title.has(t)) { score += 3 * w * idf; matched += w === 1 ? 1 : 0; } else if (body.has(t)) { score += 1.2 * w * idf; matched += w === 1 ? 0.6 : 0; }
    }
    score *= 0.6 + 0.4 * (matched / q.length);
    if (s.kind === "Pricing" && /price|cost|plan|budget|fee|much|cheap/.test(query.toLowerCase())) score *= 1.4;
    if (s.href === page) score *= 1.5;
    return { s, score };
  }).filter((x) => x.score > 1.2).sort((a, b) => b.score - a.score);
  const out: Source[] = [...onPage];
  const perHref = new Map<string, number>();
  for (const s of onPage) perHref.set(s.href, (perHref.get(s.href) ?? 0) + 1);
  for (const { s } of scored) {
    if (out.length >= limit) break;
    if (out.some((x) => x.id === s.id)) continue;
    const n = perHref.get(s.href) ?? 0;
    if (n >= 2) continue;
    perHref.set(s.href, n + 1);
    out.push(s);
  }
  return out;
}

/** Sources as numbered, length-capped context for the model. Text is data, never instructions. */
export function sourcesBlock(sources: Source[]): string {
  return sources.map((s, i) => `[${i + 1}] ${s.title} (${s.kind}; link ${s.href})\n${s.text.replace(/\s+/g, " ").slice(0, 600)}`).join("\n\n");
}

/** Internal links the assistant may suggest: catalogue pages plus anything it was given as a source. */
export function allowedPaths(sources: Source[]): Set<string> {
  const set = new Set<string>();
  for (const s of [...baseSources(), ...sources]) if (s.href.startsWith("/")) set.add(s.href.split("#")[0]);
  return set;
}
