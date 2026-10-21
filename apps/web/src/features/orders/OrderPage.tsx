"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money, human, upload, type Schemas } from "@/lib/api";
import { ShopHeader } from "@/features/catalog/Storefront";
import { DataForm } from "@/components/Form";
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}
export default function OrderPage({ id }: { id: string }) {
  const q = useQueryClient(),
    [message, setMessage] = useState(""),
    [manual, setManual] = useState(false),
    [proof, setProof] = useState<Schemas["Media"]>(),
    [accepted, setAccepted] = useState(false);
  const {
    data: o,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () =>
      api<Schemas["Order"]>("get", "/api/v1/orders/{orderId}", undefined, {
        orderId: id,
      }),
    refetchInterval: (query) =>
      ["pending", "under_review"].includes(
        query.state.data?.payment_status || "",
      )
        ? 5000
        : false,
  });
  const { data: instructions, error: manualError } = useQuery({
    queryKey: ["manual", id],
    queryFn: () =>
      api<Schemas["ManualInstructions"]>(
        "get",
        "/api/v1/orders/{orderId}/manual-payment-instructions",
        undefined,
        { orderId: id },
      ),
    enabled: manual,
  });
  async function pay() {
    if (!o?.current_quote || !accepted) return;
    try {
      const p = await api<Schemas["PaymentAttempt"]>(
        "post",
        "/api/v1/orders/{orderId}/payment-attempts",
        {
          quote_id: o.current_quote.id,
          quote_version: o.current_quote.version,
          accept_quote: true,
        },
        { orderId: id },
        crypto.randomUUID(),
      );
      await q.invalidateQueries({ queryKey: ["order", id] });
      if (p.status === "unknown" || !p.provider_order_id || !p.public_key_id) {
        setMessage(
          "Payment creation is being checked. Please wait; do not make another payment.",
        );
        return;
      }
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(
              new Error(
                "Could not load secure checkout. Your payment attempt remains pending.",
              ),
            );
          document.head.appendChild(script);
        });
      new window.Razorpay!({
        key: p.public_key_id,
        amount: p.amount_minor,
        currency: "INR",
        order_id: p.provider_order_id,
        name: "Auraflare",
        description: "Your confirmed candle order",
        handler: async (result) => {
          try {
            await api(
              "post",
              "/api/v1/orders/{orderId}/payment-attempts/{attemptId}/verify",
              result,
              { orderId: id, attemptId: p.id },
            );
            await q.invalidateQueries({ queryKey: ["order", id] });
            setMessage(
              "Payment verification received. Your order status below is authoritative.",
            );
          } catch (e) {
            setMessage((e as Error).message);
          }
        },
        modal: {
          ondismiss: () =>
            setMessage(
              "Checkout closed. We are checking the attempt before another payment can be made.",
            ),
        },
      }).open();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <ShopHeader />
      <main className="app-section">
        <div className="eyebrow">YOUR AURAFLARE MOMENT</div>
        <h1>
          Your <em>order.</em>
        </h1>
        {isLoading ? (
          <p>Opening your order…</p>
        ) : error ? (
          <div role="alert">
            <p>{(error as Error).message}</p>
            <Link className="button" href="/orders/access">
              Request secure access ↗
            </Link>
          </div>
        ) : (
          o && (
            <>
              <div className="order-card">
                <h2>{o.number}</h2>
                <div className="inline-actions">
                  <span className="status-chip">{human(o.status)}</span>
                  <span className="status-chip">{human(o.payment_status)}</span>
                  <span className="status-chip">
                    {human(o.fulfillment_status)}
                  </span>
                </div>
                <p>
                  Requested{" "}
                  {new Date(o.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </p>
                {o.items.map((i, n) => (
                  <div className="cart-line" key={n}>
                    <span>
                      {i.title} × {i.quantity}
                    </span>
                    <strong>{money(i.line_total_minor)}</strong>
                  </div>
                ))}
                <dl className="order-breakdown">
                  <div>
                    <dt>Products</dt>
                    <dd>{money(o.subtotal_minor)}</dd>
                  </div>
                  <div>
                    <dt>Tax</dt>
                    <dd>{money(o.tax_minor)}</dd>
                  </div>
                  <div>
                    <dt>Shipping</dt>
                    <dd>
                      {o.shipping_minor === null
                        ? "Awaiting studio confirmation"
                        : money(o.shipping_minor)}
                    </dd>
                  </div>
                  <div>
                    <dt>Final total</dt>
                    <dd>
                      {o.total_minor === null
                        ? "Awaiting shipping quote"
                        : money(o.total_minor)}
                    </dd>
                  </div>
                </dl>
                {o.reservation_expires_at && (
                  <p>
                    Stock hold deadline:{" "}
                    {new Date(o.reservation_expires_at).toLocaleString(
                      "en-IN",
                      { timeZone: "Asia/Kolkata" },
                    )}{" "}
                    IST.
                  </p>
                )}
                {o.current_quote && (
                  <p>
                    Quote valid until{" "}
                    {new Date(o.current_quote.expires_at).toLocaleString(
                      "en-IN",
                      { timeZone: "Asia/Kolkata" },
                    )}{" "}
                    IST.
                  </p>
                )}
                {o.allowed_actions.includes("claim") && (
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await api(
                          "post",
                          "/api/v1/orders/{orderId}/claim",
                          undefined,
                          { orderId: id },
                        );
                        await q.invalidateQueries({ queryKey: ["order", id] });
                        setMessage("This order is now linked to your account.");
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    Save this order to my account ↗
                  </button>
                )}
                {o.allowed_actions.includes("pay") && (
                  <>
                    <label className="inline-actions">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      I accept quote {o.current_quote?.version} and the final
                      total of {money(o.total_minor)}.
                    </label>
                    <div className="inline-actions">
                      <button
                        className="button"
                        disabled={!accepted}
                        onClick={pay}
                      >
                        Pay securely with Razorpay ↗
                      </button>
                      <button
                        className="text-link"
                        onClick={() => setManual(true)}
                      >
                        Manual payment options
                      </button>
                    </div>
                  </>
                )}
                {["pending", "under_review"].includes(o.payment_status) && (
                  <p className="notice">
                    {o.payment_status === "under_review"
                      ? "Your manual payment is under review. It is not marked paid until the owner verifies received funds."
                      : "Your payment is being verified. Please wait before attempting another payment."}
                  </p>
                )}
                {o.payment_status === "exception" && (
                  <p className="notice">
                    A payment needs the studio’s attention. Fulfillment is
                    paused while the owner resolves it.
                  </p>
                )}
                {o.shipment && (
                  <div className="notice">
                    <strong>{o.shipment.carrier}</strong>
                    <p>Tracking: {o.shipment.tracking_number}</p>
                    {o.shipment.tracking_url && (
                      <a
                        href={o.shipment.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Track your parcel ↗
                      </a>
                    )}
                  </div>
                )}
                {o.allowed_actions.includes("cancel") && (
                  <DataForm
                    submit="Cancel unpaid request"
                    fields={[
                      {
                        name: "reason",
                        label: "Cancellation reason",
                        required: true,
                      },
                    ]}
                    onSubmit={async (d) => {
                      await api(
                        "post",
                        "/api/v1/orders/{orderId}/cancel",
                        { expected_version: o.version, reason: d.reason },
                        { orderId: id },
                        crypto.randomUUID(),
                      );
                      await q.invalidateQueries({ queryKey: ["order", id] });
                    }}
                  />
                )}
              </div>
              {manual && (
                <div className="order-card">
                  <h2>Manual payment</h2>
                  {manualError ? (
                    <p role="alert">{(manualError as Error).message}</p>
                  ) : instructions ? (
                    <>
                      <p>{instructions.instructions}</p>
                      <p>Payee: {instructions.payee_name}</p>
                      <p>Destination: {instructions.payment_destination}</p>
                      <p>Exact amount: {money(instructions.amount_minor)}</p>
                      <label className="field-row">
                        Optional payment proof
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={async (e) => {
                            try {
                              if (e.target.files?.[0])
                                setProof(
                                  await upload(
                                    e.target.files[0],
                                    "manual_payment_proof",
                                    id,
                                  ),
                                );
                            } catch (err) {
                              setMessage((err as Error).message);
                            }
                          }}
                        />
                      </label>
                      {proof && (
                        <p>
                          {proof.status === "ready"
                            ? "Proof is ready."
                            : "Proof is awaiting the security scan. Submit without the attachment, or wait for scanning."}
                        </p>
                      )}
                      <DataForm
                        submit="Submit payment for owner review"
                        fields={[
                          {
                            name: "reference",
                            label: "Payment reference",
                            required: true,
                          },
                        ]}
                        onSubmit={async (d) => {
                          if (!accepted || !o.current_quote)
                            throw new Error("Accept the final quote first.");
                          await api(
                            "post",
                            "/api/v1/orders/{orderId}/manual-payment-evidence",
                            {
                              quote_id: o.current_quote.id,
                              quote_version: o.current_quote.version,
                              accept_quote: true,
                              reference: d.reference,
                              ...(proof?.status === "ready"
                                ? { media_id: proof.id }
                                : {}),
                            },
                            { orderId: id },
                            crypto.randomUUID(),
                          );
                          setManual(false);
                          await q.invalidateQueries({
                            queryKey: ["order", id],
                          });
                        }}
                      />
                    </>
                  ) : (
                    <p>Loading payment instructions…</p>
                  )}
                </div>
              )}
            </>
          )
        )}
        <p role="status">{message}</p>
      </main>
    </>
  );
}
