import Storefront from "@/features/catalog/Storefront";
import { publicApi } from "@/lib/public";
export default async function Home() {
  const api = publicApi();
  const [products, collections, content] = await Promise.all([
    api.GET("/api/v1/products"),
    api.GET("/api/v1/collections"),
    api.GET("/api/v1/content/home"),
  ]);
  return (
    <Storefront
      initialProducts={products.data?.data || []}
      initialCollections={collections.data?.data || []}
      initialContent={content.data?.data}
    />
  );
}
