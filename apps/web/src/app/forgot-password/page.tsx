import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Forgot Password",
};
export default function Page() {
  return <AuthPage mode="forgot-password" />;
}
