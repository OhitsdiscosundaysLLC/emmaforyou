import { useSettings } from "./site-settings";
import { detectUiLang, installLanguageHeader } from "./visitor-language";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "fr" | "es" | "de";

export const LANGUAGES: Record<Lang, { label: string; name: string; flag: string }> = {
  en: { label: "EN", name: "English", flag: "🇬🇧" },
  fr: { label: "FR", name: "Français", flag: "🇫🇷" },
  es: { label: "ES", name: "Español", flag: "🇪🇸" },
  de: { label: "DE", name: "Deutsch", flag: "🇩🇪" },
};

type Dict = Record<string, string>;

export const TRANSLATIONS: Record<Lang, Dict> = {
  en: {
    nav_home: "Home",
    nav_about: "About",
    nav_services: "Services",
    nav_testimonials: "Testimonials",
    nav_cases: "Case Studies",
    nav_analyser: "Business Analyser",
    cta_waitlist: "Start a project",
    cta_start: "Get my free growth plan",
    cta_watch: "Watch How It Works",
    hero_badge: "🌍 Trusted by businesses across 3 continents",
    hero_title_1: "Websites, AI and automation",
    hero_title_2: "that turn visitors into",
    hero_title_3: "",
    hero_title_4: "paying customers",
    hero_sub: "For local businesses, online stores, communities and growing startups. We build the website or store, set up AI that answers and books your customers day and night, and automate the follow-up, so no enquiry slips away.",
    analyser_title: "Free Business Analyser",
    analyser_sub: "Answer a few quick questions and get a personalised growth roadmap.",
    analyser_teaser_title: "Get Your Free Business Health Score",
    analyser_teaser_sub: "4 quick questions. Instant insights. Zero spam.",
    analyser_get_full: "Get the Full 10-Step Deep Analysis →",
    waitlist_title: "Be First. Get Early Access. Grow Faster.",
    next: "Next",
    back: "Back",
    get_results: "Get My Results",
    score_label: "Your Business Health Score",
  },
  fr: {
    nav_home: "Accueil",
    nav_about: "À propos",
    nav_services: "Services",
    nav_testimonials: "Témoignages",
    nav_cases: "Études de cas",
    nav_analyser: "Analyseur",
    cta_waitlist: "Démarrer un projet",
    cta_start: "Mon plan de croissance gratuit",
    cta_watch: "Voir comment ça marche",
    hero_badge: "🌍 Choisi par des entreprises sur 3 continents",
    hero_title_1: "Sites web, IA et automatisation",
    hero_title_2: "qui transforment vos visiteurs en",
    hero_title_3: "",
    hero_title_4: "clients payants",
    hero_sub: "Pour les commerces locaux, boutiques en ligne, communautés et startups. Nous créons votre site ou boutique, une IA qui répond à vos clients et prend leurs rendez-vous jour et nuit, et nous automatisons le suivi pour qu'aucune demande ne se perde.",
    analyser_title: "Analyseur d'entreprise gratuit",
    analyser_sub: "Répondez à quelques questions et obtenez une feuille de route personnalisée.",
    analyser_teaser_title: "Obtenez votre score gratuit",
    analyser_teaser_sub: "4 questions rapides. Insights instantanés. Zéro spam.",
    analyser_get_full: "Obtenir l'analyse complète en 10 étapes →",
    waitlist_title: "Soyez parmi les premiers. Croissez plus vite.",
    next: "Suivant",
    back: "Retour",
    get_results: "Voir mes résultats",
    score_label: "Score de santé digitale",
  },
  es: {
    nav_home: "Inicio",
    nav_about: "Nosotros",
    nav_services: "Servicios",
    nav_testimonials: "Testimonios",
    nav_cases: "Casos",
    nav_analyser: "Analizador",
    cta_waitlist: "Iniciar un proyecto",
    cta_start: "Mi plan de crecimiento gratis",
    cta_watch: "Ver cómo funciona",
    hero_badge: "🌍 Elegido por empresas en 3 continentes",
    hero_title_1: "Webs, IA y automatización",
    hero_title_2: "que convierten visitas en",
    hero_title_3: "",
    hero_title_4: "clientes que pagan",
    hero_sub: "Para negocios locales, tiendas online, comunidades y startups. Creamos tu web o tienda, una IA que responde y agenda a tus clientes día y noche, y automatizamos el seguimiento para que ninguna consulta se pierda.",
    analyser_title: "Analizador de negocios gratis",
    analyser_sub: "Responde unas preguntas y obtén una hoja de ruta personalizada.",
    analyser_teaser_title: "Obtén tu puntaje de salud digital",
    analyser_teaser_sub: "4 preguntas rápidas. Insights instantáneos. Cero spam.",
    analyser_get_full: "Obtener el análisis completo de 10 pasos →",
    waitlist_title: "Sé el primero. Crece más rápido.",
    next: "Siguiente",
    back: "Atrás",
    get_results: "Ver mis resultados",
    score_label: "Puntaje de salud digital",
  },
  de: {
    nav_home: "Start",
    nav_about: "Über uns",
    nav_services: "Leistungen",
    nav_testimonials: "Stimmen",
    nav_cases: "Fallstudien",
    nav_analyser: "Analyser",
    cta_waitlist: "Projekt starten",
    cta_start: "Meinen kostenlosen Wachstumsplan",
    cta_watch: "So funktioniert's",
    hero_badge: "🌍 Vertraut von Unternehmen auf 3 Kontinenten",
    hero_title_1: "Websites, KI und Automatisierung,",
    hero_title_2: "die Besucher zu",
    hero_title_3: "",
    hero_title_4: "zahlenden Kunden machen",
    hero_sub: "Für lokale Unternehmen, Onlineshops, Communitys und Start-ups. Wir bauen Ihre Website oder Ihren Shop, richten eine KI ein, die Kunden rund um die Uhr antwortet und Termine bucht, und automatisieren das Nachfassen, damit keine Anfrage verloren geht.",
    analyser_title: "Kostenloser Business-Analyser",
    analyser_sub: "Beantworten Sie ein paar Fragen und erhalten Sie eine personalisierte Wachstums-Roadmap.",
    analyser_teaser_title: "Ihr kostenloser Digital-Health-Score",
    analyser_teaser_sub: "4 schnelle Fragen. Sofortige Insights. Kein Spam.",
    analyser_get_full: "Vollständige 10-Schritt-Analyse anfordern →",
    waitlist_title: "Seien Sie der Erste. Wachsen Sie schneller.",
    next: "Weiter",
    back: "Zurück",
    get_results: "Ergebnisse anzeigen",
    score_label: "Digital-Health-Score",
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

const STORAGE_KEY = "emma_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: Lang | null = null;
    try { stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null; } catch { /* storage blocked */ }
    if (stored && stored in LANGUAGES) setLangState(stored);
    // No choice yet: follow the browser's language (English when we don't have that language).
    else setLangState(detectUiLang(navigator.languages?.length ? navigator.languages : [navigator.language]));
    installLanguageHeader();
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      // The /fr and /de pages are real translations; keep their language attribute.
      const fixed = /^\/(fr|de)(\/|$)/.exec(window.location.pathname);
      document.documentElement.lang = fixed ? fixed[1] : lang;
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") { try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* storage blocked */ } }
  };

  // Other parts of the site (the translation notice's "Show English") can switch the interface language.
  useEffect(() => {
    const on = (e: Event) => { const l = (e as CustomEvent<string>).detail as Lang; if (l in LANGUAGES) { setLangState(l); try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage blocked */ } } };
    window.addEventListener("efy-lang", on);
    return () => window.removeEventListener("efy-lang", on);
  }, []);

  const overrides = useSettings();
  // Owner edits from the control room (Translations) win over the built-in text.
  const t = (key: string) => overrides[`i18n:${lang}:${key}`]?.text ?? TRANSLATIONS[lang][key] ?? overrides[`i18n:en:${key}`]?.text ?? TRANSLATIONS.en[key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
