import type { Metadata } from "next";
import Providers from "@/lib/providers";
import "@/styles/storefront.css";
import "@/styles/admin.css";
import "@/styles/application.css";
export const metadata: Metadata = {
  title: {
    default: "Auraflare — A little light, a slower moment",
    template: "%s | Auraflare",
  },
  description:
    "The Auraflare candle studio. Explore the collection and request your order. Shipping is confirmed by the studio before payment.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/cormorant-garamond-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/cormorant-garamond-italic-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
