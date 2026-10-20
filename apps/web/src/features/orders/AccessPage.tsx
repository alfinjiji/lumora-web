"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataForm } from "@/components/Form";
import { ShopHeader } from "@/features/catalog/Storefront";
import { api } from "@/lib/api";
export default function AccessPage() {
  const router = useRouter(),
    token = useRef(""),
    [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("token");
    if (value) {
      token.current = value;
      history.replaceState(null, "", location.pathname);
      setTimeout(() => setHasToken(true), 0);
    }
  }, []);
  return (
    <>
      <ShopHeader />
      <main className="app-section">
        <h1>
          Find your <em>order.</em>
        </h1>
        <p>
          Access is private to your browser. A secure link can restore access on
          another device.
        </p>
        {hasToken ? (
          <DataForm
            fields={[]}
            submit="Restore secure order access"
            onSubmit={async () => {
              const result = await api<{ order_id: string }>(
                "post",
                "/api/v1/guest-order-access/exchange",
                { token: token.current },
              );
              router.push("/orders/" + result.order_id);
            }}
          />
        ) : (
          <DataForm
            fields={[
              { name: "number", label: "Order number", required: true },
              {
                name: "email",
                label: "Order email",
                type: "email",
                required: true,
              },
            ]}
            submit="Request secure access link"
            onSubmit={async (d) => {
              await api("post", "/api/v1/guest-order-access/request", d);
            }}
          />
        )}
      </main>
    </>
  );
}
