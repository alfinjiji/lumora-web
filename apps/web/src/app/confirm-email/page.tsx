import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Confirm Email",
};
export default function Page() {
  return <AuthPage mode="confirm-email" />;
}
