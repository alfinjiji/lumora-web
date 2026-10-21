import AdminShell from "@/features/admin/AdminShell";
export const metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminShell />;
}
