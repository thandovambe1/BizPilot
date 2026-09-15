import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BizPilot — Your AI business manager",
    short_name: "BizPilot",
    description: "AI business operating system for South African SMEs: leads, WhatsApp, quotes, jobs, invoices and follow-ups on autopilot.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f5f1",
    theme_color: "#0B1F3D",
    lang: "en-ZA",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-512.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
