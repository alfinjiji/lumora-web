"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ShopHeader } from "@/features/catalog/Storefront";
import { DataForm } from "@/components/Form";
import { api, money, type Schemas } from "@/lib/api";
export default function CheckoutPage() {
  const router = useRouter(),
    q = useQueryClient(),
    key = useRef("");
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Schemas["Cart"]>("get", "/api/v1/cart"),
  });
  return (
    <>
      <ShopHeader />
      <main className="app-section">
        <div className="eyebrow">ONE THOUGHTFUL STEP</div>
        <h1>
          Request your <em>order.</em>
        </h1>
        <p>
          We’ll confirm the shipping charge. You review the final quote before
          paying.
        </p>
        <div className="notice">
          Product subtotal: {cart ? money(cart.subtotal_minor) : "Loading…"} ·
          Shipping pending. Ready stock is reserved after a successful request.
        </div>
        <DataForm
          submit="Submit order request"
          fields={[
            { name: "name", label: "Full name", required: true },
            {
              name: "email",
              label: "Email address",
              type: "email",
              required: true,
            },
            {
              name: "phone",
              label: "Phone number",
              type: "tel",
              required: true,
            },
            { name: "line1", label: "Address line 1", required: true },
            { name: "line2", label: "Address line 2" },
            { name: "city", label: "City", required: true },
            { name: "postcode", label: "PIN code", required: true },
            {
              name: "state_code",
              label: "State",
              value: "KL",
              required: true,
              options: [{ value: "KL", label: "Kerala" }],
            },
            { name: "customer_note", label: "Order note", type: "textarea" },
            {
              name: "accept_terms",
              label: "I accept the ordering terms",
              required: true,
              options: [{ value: "true", label: "I agree" }],
            },
          ]}
          onSubmit={async (d) => {
            if (!cart?.items.length) throw new Error("Your bag is empty.");
            const address = {
              line1: d.line1,
              line2: d.line2 || "",
              city: d.city,
              postcode: d.postcode,
              state_code: "KL",
              country_code: "IN",
            };
            const delivery = await api<Schemas["DeliveryResult"]>(
              "post",
              "/api/v1/delivery/check",
              {
                city: address.city,
                state_code: address.state_code,
                postcode: address.postcode,
              },
            );
            if (!delivery.serviceable) throw new Error(delivery.message);
            key.current ||= crypto.randomUUID();
            const order = await api<Schemas["Order"]>(
              "post",
              "/api/v1/order-requests",
              {
                cart_id: cart.id,
                expected_cart_version: cart.version,
                contact: { name: d.name, email: d.email, phone: d.phone },
                address,
                customer_note: d.customer_note || "",
                accept_terms: d.accept_terms === "true",
              },
              undefined,
              key.current,
            );
            await q.invalidateQueries({ queryKey: ["cart"] });
            router.push("/orders/" + order.id);
          }}
        />
        <p>You can request an order as a guest. An account is optional.</p>
      </main>
    </>
  );
}
