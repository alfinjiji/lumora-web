import type { MetadataRoute } from "next";
import { publicApi } from "@/lib/public";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_SITE_URL || "http://localhost:5173";
  const client = publicApi();
  const entries: MetadataRoute.Sitemap = [{ url: base }];
  for (const endpoint of ["/api/v1/products", "/api/v1/collections"] as const) {
    for (let page = 1; page <= 10000; page++) {
      const response = await client.GET(endpoint, {
        params: { query: { page, per_page: 100 } },
      });
      if (response.error)
        throw new Error("Catalogue sitemap is temporarily unavailable.");
      for (const item of response.data.data)
        entries.push({
          url:
            base +
            (endpoint.endsWith("products") ? "/products/" : "/collections/") +
            item.slug,
        });
      if (!response.data.links?.next) break;
    }
  }
  return entries;
}
