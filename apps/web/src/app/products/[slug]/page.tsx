import { notFound } from "next/navigation";
import { publicApi } from "@/lib/public";
import ProductDetail from "@/features/catalog/ProductDetail";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await publicApi().GET("/api/v1/products/{slug}", {
    params: { path: { slug } },
  });
  return { title: r.data?.data.title || "Candle" };
}
export default async function Product({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await publicApi().GET("/api/v1/products/{slug}", {
    params: { path: { slug } },
  });
  if (!r.data) notFound();
  return <ProductDetail product={r.data.data} />;
}
