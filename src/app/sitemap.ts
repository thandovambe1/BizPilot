import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/auth`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
