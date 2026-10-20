"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShopHeader } from "@/features/catalog/Storefront";
import { api, money, type Schemas } from "@/lib/api";
export default function CartPage() {
  const q = useQueryClient(),
    [error, setError] = useState("");
  const { data: c, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Schemas["Cart"]>("get", "/api/v1/cart"),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Schemas["Product"][]>("get", "/api/v1/products"),
  });
  async function change(id: string, quantity?: number) {
    if (!c) return;
    try {
      await api(
        quantity === undefined ? "delete" : "patch",
        "/api/v1/cart/items/{itemId}",
        {
          expected_version: c.version,
          ...(quantity === undefined ? {} : { quantity }),
        },
        { itemId: id },
      );
      await q.invalidateQueries({ queryKey: ["cart"] });
      setError("");
    } catch (e) {
      setError((e as Error).message);
      q.invalidateQueries({ queryKey: ["cart"] });
    }
  }
  return (
    <>
      <ShopHeader />
      <main className="app-section">
        <div className="eyebrow">A FEW LOVELY THINGS</div>
        <h1>
          Your <em>bag.</em>
        </h1>
        {isLoading ? (
          <p>Opening your bag…</p>
        ) : !c?.items.length ? (
          <div className="empty-state">
            <h3>A little room for something lovely.</h3>
            <Link className="button" href="/#collection">
              Explore the collection ↗
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-list">
              {c.items.map((i) => {
                const p = products.find((p) =>
                  p.variants.some((v) => v.id === i.variant_id),
                );
                return (
                  <article className="cart-line" key={i.id}>
                    <div>
                      <h2>{p?.title || "Candle variant"}</h2>
                      <p>
                        {money(i.unit_price_minor)} each ·{" "}
                        {i.available_quantity} available
                      </p>
                      <label>
                        Quantity{" "}
                        <input
                          aria-label={"Quantity for " + (p?.title || "candle")}
                          type="number"
                          min={1}
                          max={100}
                          value={i.quantity}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isInteger(v) && v > 0) change(i.id, v);
                          }}
                        />
                      </label>
                      <button
                        className="text-link"
                        onClick={() => change(i.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <strong>{money(i.line_total_minor)}</strong>
                  </article>
                );
              })}
            </div>
            <div className="order-card">
              <div className="order-breakdown">
                <div>
                  <span>Product subtotal</span>
                  <strong>{money(c.subtotal_minor)}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <span>Pending studio confirmation</span>
                </div>
              </div>
              <p>No payment is taken when you submit an order request.</p>
              <Link className="button" href="/checkout">
                Request your order ↗
              </Link>
            </div>
          </>
        )}
        <p role="alert">{error}</p>
      </main>
    </>
  );
}
