export const site = {
  name: "CompanionAI",
  tagline: "A calm, caring space to talk things through.",
  description:
    "CompanionAI is a supportive wellness companion that answers with cited, trusted sources and hands off to a real person when it matters. Not a medical service.",
  disclaimer: "Not a medical service. In crisis, call or text 988.",
  // Off until the Google provider is configured in Supabase; set NEXT_PUBLIC_GOOGLE_AUTH=1 to show it.
  googleAuth: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1",
} as const;

export type NavLink = { href: string; label: string };

export const mainNav: NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/safety", label: "Safety" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Chat" },
      { href: "/mood", label: "Mood tracker" },
      { href: "/pricing", label: "Pricing" },
      { href: "/safety", label: "How we keep you safe" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export const crisisLinks = {
  call: "tel:988",
  text: "sms:988",
  chat: "https://988lifeline.org/chat/",
  international: "https://findahelpline.com/",
} as const;
