import { notFound } from "next/navigation";
import Storefront from "@/features/catalog/Storefront";
import { publicApi } from "@/lib/public";
export default async function Collection({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = publicApi();
  const r = await api.GET("/api/v1/collections/{slug}", {
    params: { path: { slug } },
  });
  if (!r.data) notFound();
  const [p, c] = await Promise.all([
    api.GET("/api/v1/products", { params: { query: { collection: slug } } }),
    api.GET("/api/v1/collections"),
  ]);
  return (
    <Storefront
      initialProducts={p.data?.data || []}
      initialCollections={c.data?.data || []}
      collectionSlug={slug}
    />
  );
}
