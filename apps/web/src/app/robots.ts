import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/orders",
        "/checkout",
        "/cart",
        "/login",
        "/register",
        "/auth",
        "/api",
        "/accept-invitation",
        "/reset-password",
      ],
    },
  };
}
