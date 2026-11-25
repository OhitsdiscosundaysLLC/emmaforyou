import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import SectionHead from "../future/SectionHead";
import { AUDIENCES, NEEDS, type AudienceId, type NeedId } from "@/lib/audiences";
import { attribution, submitLead } from "@/lib/leads";
import { track } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";

const WHATSAPP_URL = "https://wa.me/message/HHGMMWMRJFYUC1";
const TIMELINES = ["As soon as possible", "Within 1–3 months", "Just exploring"];
const BUDGETS = ["Not sure yet", "Under $500", "$500–$2,000", "$2,000–$5,000", "$5,000+"];

/**
 * 60-second enquiry: the short alternative to the full onboarding brief. Saves to `leads`
 * (source quick_enquiry, so the owner alert fires and it shows in the dashboard) with the services
 * it maps to and the visitor's first page/referrer/UTM tags. Opened pre-filled by `openEnquiry()`.
 */
export default function QuickEnquiry() {
  const { lang } = useI18n();
  const [audience, setAudience] = useState<AudienceId | "">("");
  const [needs, setNeeds] = useState<NeedId[]>([]);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [timeline, setTimeline] = useState(TIMELINES[0]);
  const [budget, setBudget] = useState(BUDGETS[0]);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const opened = useRef(false);

  useEffect(() => {
    attribution();
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ audience?: AudienceId }>).detail?.audience;
      if (id) { setAudience(id); setNeeds(AUDIENCES.find((a) => a.id === id)?.needs ?? []); }
      window.setTimeout(() => document.getElementById("qe-name")?.focus({ preventScroll: true }), 500);
    };
    window.addEventListener("efy:enquire", onOpen);
    return () => window.removeEventListener("efy:enquire", onOpen);
  }, []);

  const touch = () => { if (!opened.current) { opened.current = true; track("enquiry_started", { audience: audience || "none" }); } };
  const toggle = (id: NeedId) => { touch(); setNeeds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const phone = whatsapp.trim();
    const mail = email.trim();
    if (name.trim().length < 2) return setError("Please tell us your name.");
    if (!phone && !mail) return setError("Add a WhatsApp number or an email so we can reply.");
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return setError("That email address doesn't look right.");
    if (phone && phone.replace(/\D/g, "").length < 7) return setError("That WhatsApp number looks too short.");
    if (!needs.length) return setError("Pick at least one thing you need help with.");
    if (!consent) return setError("Please tick the box so we're allowed to reply to you.");
    // Bots fill hidden fields or submit instantly; pretend success and save nothing.
    if (trap || Date.now() - started.current < 2500) { setDone(true); return; }
    setBusy(true);
    const aud = AUDIENCES.find((a) => a.id === audience);
    const services = [...new Set(needs.flatMap((n) => NEEDS.find((x) => x.id === n)?.services ?? []))];
    const res = await submitLead({
      source: "quick_enquiry",
      name: name.trim().slice(0, 80),
      whatsapp: phone.slice(0, 30) || undefined,
      email: mail.slice(0, 120) || undefined,
      business_name: business.trim().slice(0, 80) || undefined,
      business_type: aud?.label,
      challenges: needs.map((n) => NEEDS.find((x) => x.id === n)?.label ?? n),
      recommended_services: services,
      timeline,
      budget,
      goal: message.trim().slice(0, 500) || needs.map((n) => NEEDS.find((x) => x.id === n)?.label ?? n).join(", "),
      language: lang,
      details: { audience: audience || null, consent: true, consent_at: new Date().toISOString(), page: window.location.pathname, ...attribution() },
    });
    setBusy(false);
    if (!res.ok) { setError("We couldn't send that just now. Please try again, or message us on WhatsApp."); track("enquiry_failed", { audience: audience || "none" }); return; }
    track("enquiry_submitted", { audience: audience || "none", needs: needs.join(","), timeline, budget, has_whatsapp: Boolean(phone), has_email: Boolean(mail) });
    setDone(true);
  }

  return (
    <section id="enquire" className="section-padding relative scroll-mt-24" aria-labelledby="qe-h" data-home-enquiry>
      <div className="mx-auto max-w-4xl px-5">
        <SectionHead id="qe-h" align="center" className="max-w-3xl" kicker="Free growth plan"
          title="Tell us what you need. Get a plan within 24 hours." shine={["plan", "within", "24", "hours."]}
          sub="Takes about a minute. Emmanuel's team reads every enquiry and replies with a practical plan and honest pricing. No obligation." />
        {done ? (
          <div className="mt-10 rounded-[28px] border border-emerald-500/30 bg-emerald-500/5 p-8 text-center" role="status" data-enquiry-done>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h3 className="mt-3 font-display text-2xl font-bold">Thanks{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}. Your enquiry is in.</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">We'll reply within 24 hours on {whatsapp.trim() ? "WhatsApp" : "email"}. Want to move faster? Pick a time for a free 30-minute call, or message us now.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/book" onClick={() => track("cta_click", { cta: "enquiry_done_book" })} className="btn-gold inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold"><CalendarCheck className="h-4 w-4" aria-hidden="true" /> Book a free call</Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => track("cta_click", { cta: "enquiry_done_whatsapp" })} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-6 font-semibold"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Chat on WhatsApp</a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} onFocus={touch} noValidate className="relative mt-10 grid gap-5 rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-9">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-name">Your name *
                <input id="qe-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="efy-input" required />
              </label>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-business">Business name
                <input id="qe-business" autoComplete="organization" maxLength={80} value={business} onChange={(e) => setBusiness(e.target.value)} className="efy-input" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-wa">WhatsApp number
                <input id="qe-wa" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="+234…" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="efy-input" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-email">or email
                <input id="qe-email" type="email" inputMode="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className="efy-input" />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-aud">Type of business
              <select id="qe-aud" value={audience} onChange={(e) => { const v = e.target.value as AudienceId | ""; setAudience(v); if (v && !needs.length) setNeeds(AUDIENCES.find((a) => a.id === v)?.needs ?? []); }} className="efy-input">
                <option value="">Choose one</option>
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-medium">What do you need help with? *</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {NEEDS.map((n) => (
                  <button key={n.id} type="button" aria-pressed={needs.includes(n.id)} onClick={() => toggle(n.id)} className="efy-page-chip">{n.label}</button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-time">When do you want to start?
                <select id="qe-time" value={timeline} onChange={(e) => setTimeline(e.target.value)} className="efy-input">{TIMELINES.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-budget">Budget (optional)
                <select id="qe-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className="efy-input">{BUDGETS.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="qe-msg">Anything else we should know? (optional)
              <textarea id="qe-msg" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} className="efy-input resize-none" placeholder="e.g. We get lots of Instagram DMs but miss most of them" />
            </label>
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="qe-website">Leave this empty<input id="qe-website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground" htmlFor="qe-consent">
              <input id="qe-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--emma-violet)]" />
              <span>EmmaForYou may contact me about this enquiry by WhatsApp or email. No marketing lists. See our <Link to="/privacy" className="underline">privacy policy</Link>.</span>
            </label>
            {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Prefer WhatsApp? Message us</a>
              <button type="submit" disabled={busy} className="btn-gold inline-flex min-h-12 items-center gap-2 rounded-full px-7 font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Send my enquiry <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
