import OrderPage from "@/features/orders/OrderPage";
export const metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return <OrderPage id={(await params).orderId} />;
}
