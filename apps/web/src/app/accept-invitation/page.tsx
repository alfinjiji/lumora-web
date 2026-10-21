import AuthPage from "@/features/auth/AuthPage";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Accept Invitation",
};
export default function Page() {
  return <AuthPage mode="accept-invitation" />;
}
