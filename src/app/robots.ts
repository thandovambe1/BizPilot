import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/onboarding", "/auth", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
