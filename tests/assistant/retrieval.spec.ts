/** Ask Emma retrieval: the right sources come back for real visitor questions. */
import { allowedPaths, articleSources, baseSources, retrieve, sourcesBlock } from "@/lib/assistant-knowledge";

const R: [string, boolean, unknown?][] = [];
const t = (n: string, ok: boolean, info?: unknown) => R.push([n, ok, info]);
const pool = [...baseSources(), ...articleSources([{ slug: "chatgpt-wallet-retailers", title: "ChatGPT Wallet: what online retailers should prepare for now", excerpt: "What agentic checkout means for small online stores.", category: "Ecommerce" }])];
const titles = (q: string, page?: string) => retrieve(q, pool, { page }).map((s) => `${s.kind}:${s.title}:${s.href}`);

t("pool is large and unique ids", pool.length > 150 && new Set(pool.map((s) => s.id)).size === pool.length, pool.length);
const price = titles("how much does a website cost?");
t("price question finds a plan price", price.some((x) => x.startsWith("Pricing:")), price);
const salon = titles("I run a salon and miss bookings on WhatsApp");
t("salon question finds booking/receptionist/salon pages", salon.some((x) => /salon|booking|receptionist|whatsapp/i.test(x)), salon);
const work = titles("have you built an ecommerce store for a fashion brand in Lagos?");
t("client work question finds Lagos Couture", work.some((x) => /Lagos Couture/.test(x)), work);
const art = titles("ChatGPT wallet checkout for online retailers");
t("blog article is retrievable", art.some((x) => x.startsWith("Article:") && x.includes("/blog/chatgpt-wallet-retailers")), art);
const pg = retrieve("tell me more", pool, { page: "/pricing" });
t("current page is always included", pg.some((s) => s.href === "/pricing"), pg.map((s) => s.href));
const many = retrieve("website seo ads automation app store email", pool, { limit: 8 });
const per = new Map<string, number>(); for (const s of many) per.set(s.href, (per.get(s.href) ?? 0) + 1);
t("at most 2 sources per page", [...per.values()].every((n) => n <= 2), Object.fromEntries(per));
t("limit respected", many.length <= 8);
t("nonsense finds nothing off-page", retrieve("zxqv blorf", pool).length === 0);
const work2 = pool.find((s) => s.title === "Client project: Lagos Couture");
t("client outcome is verbatim from portfolio", !!work2 && work2.text.includes("+312% traffic"), work2);
const block = sourcesBlock(retrieve("website price", pool, { limit: 3 }));
t("sources block is numbered with links", /^\[1\] .+\(.+; link \//.test(block), block.slice(0, 200));
const allowed = allowedPaths([]);
t("allowed paths include services and tools", allowed.has("/pricing") && allowed.has("/book") && [...allowed].some((p) => p.startsWith("/services/")));
t("allowed paths exclude external links", ![...allowed].some((p) => /^https?:/.test(p)));

for (const [n, ok, info] of R) if (!ok) console.log("FAIL", n, JSON.stringify(info).slice(0, 600));
console.log(`${R.filter((r) => r[1]).length}/${R.length} passed`);
if (R.some((r) => !r[1])) process.exit(1);
