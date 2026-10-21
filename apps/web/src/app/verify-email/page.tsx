import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Verify Email",
};
export default function Page() {
  return <AuthPage mode="verify-email" />;
}
