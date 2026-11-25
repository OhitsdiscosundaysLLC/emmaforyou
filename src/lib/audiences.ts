/**
 * Who EmmaForYou helps, for the homepage pathways and the quick enquiry. Copy describes what we build and
 * the problems it addresses; it makes no claims about results (no numbers, no client names).
 */
export type AudienceId = "local" | "ecommerce" | "community" | "startup" | "ai";

export interface Audience {
  id: AudienceId;
  label: string;
  who: string;
  problems: string[];
  outcome: string;
  links: { label: string; to: string }[];
  /** Pre-ticked needs in the quick enquiry. */
  needs: NeedId[];
}

export type NeedId = "customers" | "website" | "ai-chat" | "community" | "app" | "marketing" | "automation";

export const NEEDS: { id: NeedId; label: string; services: string[] }[] = [
  { id: "customers", label: "More customers or leads", services: ["lead-generation", "sales-conversion"] },
  { id: "website", label: "A new website or online store", services: ["website-landing-pages", "shopify-ecommerce"] },
  { id: "ai-chat", label: "AI chat, booking or receptionist", services: ["ai-automation"] },
  { id: "community", label: "Community or membership platform", services: ["app-development"] },
  { id: "app", label: "An app or custom software", services: ["app-development", "ui-ux-design"] },
  { id: "marketing", label: "Marketing, ads or SEO", services: ["paid-ads", "seo", "social-media-automation"] },
  { id: "automation", label: "Automating admin and follow-ups", services: ["ai-automation", "crm-systems"] },
];

export const AUDIENCES: Audience[] = [
  {
    id: "local",
    label: "Local businesses & service providers",
    who: "Salons, clinics, restaurants, trades, real estate and other local services",
    problems: ["Missed calls and DMs turn into lost bookings", "Hard to find on Google Maps and search", "Hours spent on reminders and follow-ups"],
    outcome: "An AI receptionist that answers WhatsApp, Instagram and your website day and night and books appointments, a fast website and Google profile that bring in local searches, and automatic reminders and review requests.",
    links: [{ label: "AI receptionist", to: "/ai-receptionist" }, { label: "Free website audit", to: "/website-audit" }, { label: "Booking websites", to: "/solutions/websites/booking-reservation-website" }],
    needs: ["customers", "ai-chat"],
  },
  {
    id: "ecommerce",
    label: "Online stores & ecommerce brands",
    who: "Shopify and WooCommerce stores, and brands selling on Instagram and WhatsApp",
    problems: ["Visitors browse but don't buy", "The same product and delivery questions every day", "Abandoned carts and one-time buyers"],
    outcome: "A store built to convert, an AI shopping assistant that answers product questions and recommends items, and email and WhatsApp flows that recover carts and bring buyers back.",
    links: [{ label: "Free ecommerce toolkit", to: "/ecommerce" }, { label: "Store design & builds", to: "/services/shopify-ecommerce" }, { label: "AI shopping assistant", to: "/solutions/ai-solutions/ai-shopping-assistant" }],
    needs: ["website", "ai-chat"],
  },
  {
    id: "community",
    label: "Communities & membership businesses",
    who: "Coaches, course creators, clubs, churches and associations",
    problems: ["Members scattered across WhatsApp groups", "Chasing payments and renewals by hand", "Engagement drops after the first month"],
    outcome: "Your own branded community or membership portal with paid tiers, automatic onboarding and renewals, and an AI assistant that answers members' questions.",
    links: [{ label: "Membership portals", to: "/solutions/business-apps/membership-portal" }, { label: "Community platforms", to: "/solutions/business-apps/community-platform" }, { label: "See our live community", to: "/community" }],
    needs: ["community", "automation"],
  },
  {
    id: "startup",
    label: "Startups & founders",
    who: "Turning an idea into a product people will pay for",
    problems: ["An idea that's hard to show to investors or users", "Slow, expensive first builds", "No clear plan for the first customers"],
    outcome: "A clickable prototype in minutes, a scoped plan for your first release, then a real product built and launched with you.",
    links: [{ label: "Build a free prototype", to: "/#prototype" }, { label: "Plan my app", to: "/solutions/app-planner" }, { label: "App development", to: "/services/app-development" }],
    needs: ["app"],
  },
  {
    id: "ai",
    label: "AI & automation for any business",
    who: "Teams buried in repetitive work and slow follow-ups",
    problems: ["Leads wait hours or days for a reply", "Data copied between tools by hand", "No time to follow up every enquiry"],
    outcome: "AI agents that reply to and qualify leads, CRM and workflow automation that moves data between your tools, and follow-ups that run themselves, with a person approving anything important.",
    links: [{ label: "AI automation", to: "/services/ai-automation" }, { label: "AI website chatbot", to: "/solutions/ai-solutions/ai-website-chatbot" }, { label: "CRM systems", to: "/services/crm-systems" }],
    needs: ["ai-chat", "automation"],
  },
];

/** Open the homepage quick enquiry with a business type picked (used by the pathway cards and the hero). */
export function openEnquiry(audience?: AudienceId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("efy:enquire", { detail: { audience } }));
  document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
