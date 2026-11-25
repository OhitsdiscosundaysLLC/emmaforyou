import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Store, ShoppingBag, Users, Rocket, Bot } from "lucide-react";
import SectionHead from "../future/SectionHead";
import { AUDIENCES, openEnquiry, type AudienceId } from "@/lib/audiences";
import { track } from "@/lib/analytics";

const ICONS: Record<AudienceId, typeof Store> = { local: Store, ecommerce: ShoppingBag, community: Users, startup: Rocket, ai: Bot };

/**
 * "Who we help": the visitor picks their kind of business and sees the problems we solve, what we build
 * and where to go next (existing service, solution and tool pages), plus a pre-filled enquiry.
 */
export default function AudiencePaths() {
  const [active, setActive] = useState<AudienceId>("local");
  const a = AUDIENCES.find((x) => x.id === active) ?? AUDIENCES[0];
  const Icon = ICONS[a.id];
  return (
    <section id="who-we-help" className="section-padding relative" aria-labelledby="ap-h" data-home-paths>
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead id="ap-h" align="center" className="max-w-3xl" kicker="Who we help"
          title="Pick your business. See exactly how we'd grow it." shine={["grow", "it."]}
          sub="Every business loses customers in a different place. Choose yours to see the problems we fix, what we build, and the fastest next step." />

        <div className="mt-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Type of business">
          {AUDIENCES.map((x) => {
            const I = ICONS[x.id];
            const on = x.id === active;
            return (
              <button key={x.id} type="button" role="tab" id={`ap-tab-${x.id}`} aria-selected={on} aria-controls="ap-panel"
                onClick={() => { setActive(x.id); track("audience_selected", { audience: x.id }); }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${on ? "border-[var(--emma-violet)] bg-[var(--emma-violet)] text-white shadow-lg" : "border-border bg-card hover:border-[var(--emma-violet)]"}`}>
                <I className="h-4 w-4" aria-hidden="true" />{x.label.split(" & ")[0]}
              </button>
            );
          })}
        </div>

        <div id="ap-panel" role="tabpanel" aria-labelledby={`ap-tab-${a.id}`} className="mt-8 grid gap-6 rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:p-10">
          <div className="min-w-0">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--emma-violet)]/10 text-[var(--emma-violet)]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
            <h3 className="mt-4 font-display text-2xl font-bold">{a.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{a.who}</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sound familiar?</p>
            <ul className="mt-3 grid gap-2">
              {a.problems.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />{p}</li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 rounded-2xl bg-muted/50 p-5 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--emma-violet)]">What we build for you</p>
            <p className="mt-3 text-base leading-relaxed">{a.outcome}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {a.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} onClick={() => track("cta_click", { cta: "audience_link", audience: a.id, to: l.to })}
                    className="group flex h-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold hover:border-[var(--emma-violet)]">
                    <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />{l.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => { track("cta_click", { cta: "audience_enquire", audience: a.id }); openEnquiry(a.id); }} className="btn-gold inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold">
                Get a free plan for my business <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs text-muted-foreground">60 seconds · reply within 24 hours</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
