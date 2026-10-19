import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/members", "/profile", "/onboarding", "/auth/", "/post/new"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
