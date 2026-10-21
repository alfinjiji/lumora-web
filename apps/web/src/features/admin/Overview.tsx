"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, money, type Schemas } from "@/lib/api";
import { ErrorMessage } from "./shared";
export default function Overview() {
  const { data: d, error } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api<Schemas["Dashboard"]>("get", "/api/v1/admin/overview"),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR STUDIO, AT A GLANCE</div>
          <h1>A good day to glow.</h1>
          <p className="sub">
            A little overview of your candles, customers and lovely things in
            motion.
          </p>
        </div>
        <Link className="btn primary" href="/admin/orders">
          View orders ↗
        </Link>
      </div>
      <ErrorMessage error={error} />
      <div className="banner">
        <span className="symbol">✳</span>
        <div>
          <strong>Every lovely moment starts with a little care.</strong>
          <p>Review your requests and keep the glow going.</p>
        </div>
      </div>
      <div className="stats">
        {[
          ["Order requests", d?.order_requests],
          ["Awaiting shipping quote", d?.awaiting_shipping_quote],
          ["Low stock variants", d?.low_stock_variants],
          ["Manual payments to review", d?.manual_payments_under_review],
        ].map(([label, value]) => (
          <section className="card stat" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value ?? "—"}</div>
            <small className="stat-foot">
              {label === "Order requests"
                ? "Selected reporting period"
                : "Current studio workload"}
            </small>
          </section>
        ))}
      </div>
      <div className="grid-main">
        <section className="card card-body">
          <h2>A thoughtful view of the studio.</h2>
          {d?.net_receipts_minor !== null &&
            d?.net_receipts_minor !== undefined && (
              <>
                <div className="eyebrow">NET VERIFIED RECEIPTS</div>
                <div className="stat-value">{money(d.net_receipts_minor)}</div>
                <p className="sub">
                  Verified receipts minus successful refunds during the
                  reporting period. Unpaid requests are excluded.
                </p>
              </>
            )}
          <p className="sub">
            {d
              ? new Date(d.period_start).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }) +
                " – " +
                new Date(d.period_end).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }) +
                " · Asia/Kolkata"
              : "Loading the reporting period…"}
          </p>
          <p>No sample revenue or customer activity is included.</p>
        </section>
        <section className="card attention">
          <h2>A little attention.</h2>
          {[
            ["orders", "Shipping quotes", "Review new requests"],
            ["inventory", "Ready stock", "Review availability"],
            ["enquiries", "Conversations", "Follow up with care"],
          ].map(([href, title, caption]) => (
            <Link className="task" href={"/admin/" + href} key={href}>
              <span className="task-icon">↗</span>
              <span className="task-copy">
                <strong>{title}</strong>
                <small>{caption}</small>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
