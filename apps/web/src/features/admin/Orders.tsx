"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money, human, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import Dialog from "@/components/Dialog";
import {
  useList,
  useRefresh,
  useMe,
  ErrorMessage,
  Empty,
  Pagination,
  field,
  statusOptions,
  minor,
} from "./shared";
export default function Orders() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string>(),
    [create, setCreate] = useState(false),
    [exportId, setExportId] = useState<string>();
  const { data: u } = useMe(),
    refresh = useRefresh();
  const list = useList<Schemas["AdminOrder"]>("/api/v1/admin/orders", true, {
    q: search,
    ...(status ? { status } : {}),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LOVELY THINGS IN MOTION</div>
          <h1>Every order, a little story.</h1>
          <p className="sub">
            Order requests, considered quotes and carefully packed moments.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreate(true)}>
          + Add direct order
        </button>
      </div>
      <div className="toolbar">
        <label>
          Search orders{" "}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number"
          />
        </label>
        <label>
          Status{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {[
              "awaiting_shipping_quote",
              "awaiting_payment",
              "payment_review",
              "confirmed",
              "completed",
              "cancelled",
              "expired",
            ].map((s) => (
              <option value={s} key={s}>
                {human(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorMessage error={list.error} />
      <section className="card table-card">
        <div className="table-scroll" tabIndex={0} aria-label="Orders table">
          <table>
            <thead>
              <tr>
                {[
                  "Order",
                  "Customer",
                  "Channel",
                  "Payment",
                  "Fulfillment",
                  "Total",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="order-link"
                      onClick={() => setSelected(o.id)}
                    >
                      {o.number}
                    </button>
                    <small className="member-contact">{human(o.status)}</small>
                  </td>
                  <td>{o.contact.name}</td>
                  <td>{human(o.source)}</td>
                  <td>
                    <span className="status-chip">
                      {human(o.payment_status)}
                    </span>
                  </td>
                  <td>{human(o.fulfillment_status)}</td>
                  <td>{money(o.total_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data?.length === 0 && (
          <Empty>No order requests to tend to yet.</Empty>
        )}
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      {u?.staff_role === "owner" && (
        <section className="card card-body" style={{ marginTop: 24 }}>
          <h2>Private order export</h2>
          <DataForm
            submit="Prepare CSV export"
            fields={[
              field("from", "From", "", true, "datetime-local"),
              field("to", "To", "", true, "datetime-local"),
            ]}
            onSubmit={async (d) => {
              const e = await api<Schemas["Export"]>(
                "post",
                "/api/v1/admin/order-exports",
                {
                  from: new Date(d.from).toISOString(),
                  to: new Date(d.to).toISOString(),
                },
              );
              setExportId(e.id);
            }}
          />
          {exportId && <ExportStatus id={exportId} />}
        </section>
      )}
      {selected && (
        <OrderDetail id={selected} onClose={() => setSelected(undefined)} />
      )}{" "}
      {create && (
        <DirectOrder
          onClose={() => setCreate(false)}
          onCreated={async (id) => {
            setCreate(false);
            setSelected(id);
            await refresh();
          }}
        />
      )}
    </>
  );
}
function ExportStatus({ id }: { id: string }) {
  const { data: e, error } = useQuery({
    queryKey: ["export", id],
    queryFn: () =>
      api<Schemas["Export"]>(
        "get",
        "/api/v1/admin/order-exports/{exportId}",
        undefined,
        { exportId: id },
      ),
    refetchInterval: (q) =>
      q.state.data?.status === "ready" || q.state.data?.status === "failed"
        ? false
        : 3000,
  });
  return (
    <>
      <ErrorMessage error={error} />
      {e?.download_url ? (
        <a className="btn" href={e.download_url}>
          Download private CSV ↗
        </a>
      ) : (
        <p role="status">Export: {e?.status || "queued"}</p>
      )}
    </>
  );
}
function DirectOrder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const products = useList<Schemas["Product"]>("/api/v1/admin/products"),
    [items, setItems] = useState<{ variant_id: string; quantity: number }[]>(
      [],
    ),
    [chosen, setChosen] = useState(""),
    [quantity, setQuantity] = useState(1);
  const variants =
    products.data?.flatMap((p) =>
      p.variants.filter((v) => v.active).map((v) => ({ ...v, title: p.title })),
    ) || [];
  return (
    <Dialog title="Add direct order" className="drawer" onClose={onClose}>
      <div className="eyebrow">FROM A CONVERSATION</div>
      <h2>A new lovely order.</h2>
      <p>
        Direct orders use the same prices, stock and shipping quote workflow.
      </p>
      <label className="field-row">
        Candle variant
        <select
          className="field"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">Select a candle variant</option>
          {variants.map((v) => (
            <option value={v.id} key={v.id}>
              {v.title} · {v.sku} · {money(v.price_minor)}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row">
        Quantity
        <input
          className="field"
          type="number"
          min={1}
          max={100}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </label>
      <button
        className="btn"
        disabled={!chosen || quantity < 1}
        onClick={() => {
          setItems((i) => [...i, { variant_id: chosen, quantity }]);
          setChosen("");
        }}
      >
        Add item
      </button>
      {items.map((i, n) => (
        <div className="detail-line" key={n}>
          <span>
            {variants.find((v) => v.id === i.variant_id)?.sku} × {i.quantity}
          </span>
          <button
            className="btn"
            onClick={() => setItems(items.filter((_, j) => n !== j))}
          >
            Remove
          </button>
        </div>
      ))}
      <DataForm
        submit="Create order request"
        fields={[
          {
            name: "source",
            label: "Order channel",
            required: true,
            options: statusOptions(["whatsapp", "instagram", "phone"]),
          },
          field("name", "Customer name", "", true),
          field("email", "Customer email", "", true, "email"),
          field("phone", "Phone number", "", true),
          field("line1", "Delivery address", "", true),
          field("city", "City in Kerala", "", true),
          field("postcode", "PIN code", "", true),
          field(
            "customer_note",
            "Order note",
            "",
            "false" === String(true),
            "textarea",
          ),
        ]}
        onSubmit={async (d) => {
          if (!items.length)
            throw new Error("Add at least one candle variant.");
          const o = await api<Schemas["AdminOrder"]>(
            "post",
            "/api/v1/admin/orders",
            {
              source: d.source,
              contact: { name: d.name, email: d.email, phone: d.phone },
              address: {
                line1: d.line1,
                city: d.city,
                state_code: "KL",
                postcode: d.postcode,
                country_code: "IN",
              },
              items,
              customer_note: d.customer_note || "",
            },
            undefined,
            crypto.randomUUID(),
          );
          await onCreated(o.id);
        }}
      />
    </Dialog>
  );
}
export function OrderDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const refresh = useRefresh(),
    { data: u } = useMe(),
    [message, setMessage] = useState("");
  const { data: o, error } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () =>
      api<Schemas["AdminOrder"]>(
        "get",
        "/api/v1/admin/orders/{orderId}",
        undefined,
        { orderId: id },
      ),
  });
  const owner = u?.staff_role === "owner";
  return (
    <Dialog title="Order details" className="drawer" onClose={onClose}>
      <ErrorMessage error={error} />
      {o && (
        <>
          <div className="eyebrow">A LOVELY MOMENT IN MOTION</div>
          <h2>{o.number}</h2>
          <div className="inline-actions">
            <span className="status-chip">{human(o.status)}</span>
            <span className="status-chip">{human(o.payment_status)}</span>
            <span className="status-chip">{human(o.fulfillment_status)}</span>
          </div>
          <div className="detail-block">
            <h3>{o.contact.name}</h3>
            <p>
              {o.contact.email}
              <br />
              {o.contact.phone}
            </p>
            <p>
              {o.address.line1}
              <br />
              {o.address.city}, Kerala · {o.address.postcode}
            </p>
            <small>{human(o.source)}</small>
          </div>
          {o.items.map((i, n) => (
            <div className="detail-line" key={n}>
              <span>
                {i.title} · {i.sku} × {i.quantity}
              </span>
              <strong>{money(i.line_total_minor)}</strong>
            </div>
          ))}
          <div className="detail-line">
            <span>Products / tax / shipping</span>
            <strong>
              {money(o.subtotal_minor)} / {money(o.tax_minor)} /{" "}
              {money(o.shipping_minor)}
            </strong>
          </div>
          <div className="detail-line">
            <span>Final total</span>
            <strong>{money(o.total_minor)}</strong>
          </div>
          {o.current_quote && (
            <p>
              Quote {o.current_quote.version}: {human(o.current_quote.status)} ·
              expires{" "}
              {new Date(o.current_quote.expires_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST.
            </p>
          )}
          <p className="permission">
            Stock hold:{" "}
            {o.reservation_expires_at
              ? new Date(o.reservation_expires_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                }) + " IST"
              : "—"}
          </p>
          {owner && o.allowed_actions.includes("quote") && (
            <div className="detail-block">
              <h2>Confirm shipping</h2>
              <DataForm
                key={"quote" + o.version}
                submit="Issue final quote"
                fields={[
                  field("shipping", "Shipping charge in INR", "", true),
                  field(
                    "expires_at",
                    "Quote deadline",
                    "",
                    true,
                    "datetime-local",
                  ),
                  field("note", "Quote note", "", false, "textarea"),
                ]}
                onSubmit={async (d) => {
                  await api(
                    "post",
                    "/api/v1/admin/orders/{orderId}/shipping-quotes",
                    {
                      expected_version: o.version,
                      shipping_minor: minor(d.shipping),
                      expires_at: new Date(d.expires_at).toISOString(),
                      note: d.note || "",
                    },
                    { orderId: id },
                    crypto.randomUUID(),
                  );
                  await refresh();
                }}
              />
            </div>
          )}
          {owner &&
            [
              "awaiting_shipping_quote",
              "awaiting_payment",
              "payment_review",
            ].includes(o.status) && (
              <div className="detail-block">
                <h2>Extend reservation</h2>
                <DataForm
                  key={"hold" + o.version}
                  submit="Record hold extension"
                  fields={[
                    field(
                      "expires_at",
                      "New hold deadline",
                      "",
                      true,
                      "datetime-local",
                    ),
                    field("reason", "Reason", "", true),
                  ]}
                  onSubmit={async (d) => {
                    await api(
                      "post",
                      "/api/v1/admin/orders/{orderId}/reservation-extension",
                      {
                        expected_version: o.version,
                        expires_at: new Date(d.expires_at).toISOString(),
                        reason: d.reason,
                      },
                      { orderId: id },
                      crypto.randomUUID(),
                    );
                    await refresh();
                  }}
                />
              </div>
            )}
          {o.allowed_actions.includes("packing") && (
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  await api(
                    "post",
                    "/api/v1/admin/orders/{orderId}/packing",
                    { expected_version: o.version },
                    { orderId: id },
                    crypto.randomUUID(),
                  );
                  await refresh();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Begin packing
            </button>
          )}
          {o.allowed_actions.includes("shipment") && (
            <DataForm
              key={"ship" + o.version}
              submit="Record dispatch"
              fields={[
                field("carrier", "Carrier", "", true),
                field("tracking_number", "Tracking number", "", true),
                field("tracking_url", "Tracking URL", "", false, "url"),
              ]}
              onSubmit={async (d) => {
                await api(
                  "post",
                  "/api/v1/admin/orders/{orderId}/shipment",
                  {
                    expected_version: o.version,
                    carrier: d.carrier,
                    tracking_number: d.tracking_number,
                    ...(d.tracking_url ? { tracking_url: d.tracking_url } : {}),
                  },
                  { orderId: id },
                  crypto.randomUUID(),
                );
                await refresh();
              }}
            />
          )}
          {o.allowed_actions.includes("delivered") && (
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  await api(
                    "post",
                    "/api/v1/admin/orders/{orderId}/delivered",
                    { expected_version: o.version },
                    { orderId: id },
                    crypto.randomUUID(),
                  );
                  await refresh();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Record delivery
            </button>
          )}
          {o.shipment && (
            <div className="detail-block">
              <h3>{o.shipment.carrier}</h3>
              <p>{o.shipment.tracking_number}</p>
              {o.shipment.tracking_url && (
                <a
                  href={o.shipment.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open carrier tracking ↗
                </a>
              )}
            </div>
          )}
          {owner && (
            <>
              <div className="detail-block">
                <h2>Payment history</h2>
                {o.payment_attempts.map((p) => (
                  <p key={p.id}>
                    {human(p.method)} · {human(p.status)} ·{" "}
                    {money(p.amount_minor)}
                  </p>
                ))}
                {!o.payment_attempts.length && <p>No payments initiated.</p>}
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      await api(
                        "post",
                        "/api/v1/admin/orders/{orderId}/reconcile-payment",
                        { expected_version: o.version },
                        { orderId: id },
                      );
                      await refresh();
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  Check provider payment status
                </button>
              </div>
              {o.manual_evidence.map((e) => (
                <ManualReview key={e.id} evidence={e} order={o} />
              ))}
              {o.payment_receipts?.length ? (
                <div className="detail-block">
                  <h2>Full payment refund</h2>
                  <p>
                    Refunds follow verified provider or bank outcomes. Refunding
                    does not restock goods.
                  </p>
                  <DataForm
                    submit="Request full receipt refund"
                    fields={[
                      {
                        name: "receipt",
                        label: "Verified payment receipt",
                        required: true,
                        options: o.payment_receipts.map((r) => ({
                          value: r.id,
                          label: money(r.amount_minor) + " · " + r.disposition,
                        })),
                      },
                      field("reason", "Refund reason", "", true),
                    ]}
                    onSubmit={async (d) => {
                      const receipt = o.payment_receipts?.find(
                        (r) => r.id === d.receipt,
                      );
                      if (!receipt)
                        throw new Error("Select a verified receipt.");
                      const refund = await api<Schemas["Refund"]>(
                        "post",
                        "/api/v1/admin/orders/{orderId}/refunds",
                        {
                          expected_version: o.version,
                          payment_attempt_id: receipt.attempt_id,
                          payment_receipt_id: receipt.id,
                          reason: d.reason,
                        },
                        { orderId: id },
                        crypto.randomUUID(),
                      );
                      setMessage(
                        "Refund " +
                          refund.id +
                          ": " +
                          refund.status +
                          ". Review it in Payments & audit.",
                      );
                      await refresh();
                    }}
                  />
                </div>
              ) : null}
              {!["cancelled", "expired", "completed"].includes(o.status) &&
                !["shipped", "delivered"].includes(o.fulfillment_status) && (
                  <DataForm
                    key={"cancel" + o.version}
                    submit="Cancel order"
                    fields={[field("reason", "Cancellation reason", "", true)]}
                    onSubmit={async (d) => {
                      await api(
                        "post",
                        "/api/v1/admin/orders/{orderId}/cancel",
                        { expected_version: o.version, reason: d.reason },
                        { orderId: id },
                        crypto.randomUUID(),
                      );
                      await refresh();
                    }}
                  />
                )}
              {o.status === "cancelled" && (
                <DataForm
                  submit="Record inspected stock return"
                  fields={[
                    field("reason", "Restock reason and inspection", "", true),
                  ]}
                  onSubmit={async (d) => {
                    await api(
                      "post",
                      "/api/v1/admin/orders/{orderId}/restock",
                      { expected_version: o.version, reason: d.reason },
                      { orderId: id },
                      crypto.randomUUID(),
                    );
                    await refresh();
                  }}
                />
              )}
            </>
          )}
          <p role="status">{message}</p>
        </>
      )}
    </Dialog>
  );
}
function ManualReview({
  evidence: e,
  order: o,
}: {
  evidence: Schemas["Evidence"];
  order: Schemas["AdminOrder"];
}) {
  const refresh = useRefresh(),
    [download, setDownload] = useState("");
  return (
    <div className="detail-block">
      <h2>Manual payment evidence</h2>
      <p>Reference: {e.reference}</p>
      <span className="status-chip">{e.status}</span>
      {e.media_id && (
        <button
          className="btn"
          onClick={async () => {
            try {
              const d = await api<Schemas["PrivateDownload"]>(
                "get",
                "/api/v1/admin/manual-payment-evidence/{evidenceId}/download",
                undefined,
                { evidenceId: e.id },
              );
              setDownload(d.url);
            } catch (err) {
              setDownload((err as Error).message);
            }
          }}
        >
          Prepare private proof download
        </button>
      )}
      {download.startsWith("http") ? (
        <a
          className="btn"
          href={download}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open scanned proof ↗
        </a>
      ) : (
        <p>{download}</p>
      )}
      {e.status === "under_review" && (
        <>
          <p className="permission">
            A screenshot is not proof of received money. Check the bank or
            payment account independently.
          </p>
          <DataForm
            submit="Approve verified received payment"
            fields={[
              field("bank_reference", "Verified bank reference", "", true),
              field("received", "Received amount in INR", "", true),
              field(
                "received_at",
                "Received date and time",
                "",
                true,
                "datetime-local",
              ),
              {
                name: "verified",
                label: "Independent funds verification",
                required: true,
                options: [
                  {
                    value: "true",
                    label: "I checked the actual received funds",
                  },
                ],
              },
            ]}
            onSubmit={async (d) => {
              await api(
                "post",
                "/api/v1/admin/manual-payment-evidence/{evidenceId}/approve",
                {
                  expected_version: o.version,
                  bank_reference: d.bank_reference,
                  received_amount_minor: minor(d.received),
                  received_at: new Date(d.received_at).toISOString(),
                },
                { evidenceId: e.id },
                crypto.randomUUID(),
              );
              await refresh();
            }}
          />
          <DataForm
            submit="Reject evidence"
            fields={[field("reason", "Rejection reason", "", true)]}
            onSubmit={async (d) => {
              await api(
                "post",
                "/api/v1/admin/manual-payment-evidence/{evidenceId}/reject",
                { expected_version: o.version, reason: d.reason },
                { evidenceId: e.id },
                crypto.randomUUID(),
              );
              await refresh();
            }}
          />
        </>
      )}
    </div>
  );
}
