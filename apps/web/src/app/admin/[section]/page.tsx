import AdminShell from "@/features/admin/AdminShell";
export const metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return <AdminShell section={(await params).section} />;
}
