"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ShopHeader } from "./Storefront";
import { api, money, type Schemas } from "@/lib/api";
export default function ProductDetail({
  product: p,
}: {
  product: Schemas["Product"];
}) {
  const [v, setV] = useState(p.variants[0]),
    [message, setMessage] = useState("");
  const q = useQueryClient();
  return (
    <>
      <ShopHeader />
      <main className="app-section product-page">
        {p.images[0]?.url && <img src={p.images[0].url} alt={p.title} />}
        <div>
          <Link href="/#collection">← The collection</Link>
          <h1>{p.title}</h1>
          <p>{p.description}</p>
          <p>{p.scent_notes?.join(" · ")}</p>
          <label className="field-row">
            Choose a variant
            <select
              className="field"
              value={v?.id}
              onChange={(e) =>
                setV(p.variants.find((x) => x.id === e.target.value)!)
              }
            >
              {p.variants.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.options.map((o) => o.value).join(" / ") || x.sku} —{" "}
                  {money(x.price_minor)}
                  {x.available_quantity === 0 ? " · Sold out" : ""}
                </option>
              ))}
            </select>
          </label>
          <h2>{v && money(v.price_minor)}</h2>
          <p>Shipping is confirmed by the studio before payment.</p>
          <button
            className="button"
            disabled={!v || !v.available_quantity}
            onClick={async () => {
              try {
                const c = await api<Schemas["Cart"]>("get", "/api/v1/cart");
                await api("post", "/api/v1/cart/items", {
                  expected_version: c.version,
                  variant_id: v.id,
                  quantity: 1,
                });
                q.invalidateQueries({ queryKey: ["cart"] });
                setMessage("Added to your bag.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {v?.available_quantity ? "Add to bag ↗" : "Sold out"}
          </button>
          <p role="status">{message}</p>
        </div>
      </main>
    </>
  );
}
