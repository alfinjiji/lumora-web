import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Login",
};
export default function Page() {
  return <AuthPage mode="login" />;
}
