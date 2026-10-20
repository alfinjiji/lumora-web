import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Reset Password",
};
export default function Page() {
  return <AuthPage mode="reset-password" />;
}
