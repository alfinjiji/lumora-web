"use client";
import { useState } from "react";
import { api, money, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import { OrderDetail } from "./Orders";
import { useList, useRefresh, ErrorMessage, Pagination, field } from "./shared";
export default function Finance() {
  const evidence = useList<Schemas["Evidence"]>(
      "/api/v1/admin/manual-payment-evidence",
    ),
    audit = useList<Schemas["Audit"]>("/api/v1/admin/audit"),
    refresh = useRefresh(),
    [order, setOrder] = useState<string>(),
    [refund, setRefund] = useState<Schemas["Refund"]>();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEAR VIEW OF EVERY STEP</div>
          <h1>Payments, with care.</h1>
          <p className="sub">
            Review actual received funds and follow the studio’s audit history.
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <section className="card card-body">
          <h2>Manual payment review</h2>
          <ErrorMessage error={evidence.error} />
          {evidence.data?.map((e) => (
            <div className="detail-block" key={e.id}>
              <p>{e.reference}</p>
              <span className="status-chip">{e.status}</span>
              <button className="btn" onClick={() => setOrder(e.order_id)}>
                Review order
              </button>
            </div>
          ))}
          {!evidence.data?.length && (
            <p>No manual payment evidence to review.</p>
          )}
          <Pagination {...evidence} length={evidence.data?.length || 0} />
        </section>
        <section className="card card-body">
          <h2>Refund status</h2>
          <DataForm
            submit="Find refund"
            fields={[field("reference", "Refund reference", "", true)]}
            onSubmit={async (d) => {
              setRefund(
                await api<Schemas["Refund"]>(
                  "get",
                  "/api/v1/admin/refunds/{refundId}",
                  undefined,
                  { refundId: d.reference },
                ),
              );
            }}
          />
          {refund && (
            <div className="detail-block">
              <p>
                {money(refund.amount_minor)} · {refund.status}
              </p>
              {refund.status === "requested" && (
                <DataForm
                  submit="Confirm completed manual refund"
                  fields={[
                    field(
                      "bank_reference",
                      "Verified bank transfer reference",
                      "",
                      true,
                    ),
                    field(
                      "refunded_at",
                      "Transfer date and time",
                      "",
                      true,
                      "datetime-local",
                    ),
                  ]}
                  onSubmit={async (d) => {
                    const r = await api<Schemas["Refund"]>(
                      "post",
                      "/api/v1/admin/refunds/{refundId}/manual-confirmation",
                      {
                        expected_version: refund.version,
                        bank_reference: d.bank_reference,
                        refunded_at: new Date(d.refunded_at).toISOString(),
                      },
                      { refundId: refund.id },
                      crypto.randomUUID(),
                    );
                    setRefund(r);
                    await refresh();
                  }}
                />
              )}
              <button className="btn" onClick={() => setOrder(refund.order_id)}>
                View order
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="card table-card" style={{ marginTop: 24 }}>
        <div className="table-top">
          <h2>Studio audit trail</h2>
        </div>
        <div className="table-scroll" tabIndex={0} aria-label="Audit history">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Record</th>
                <th>Time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.map((a) => (
                <tr key={a.id}>
                  <td>{a.action.replaceAll(".", " ")}</td>
                  <td>{a.entity_type}</td>
                  <td>
                    {new Date(a.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...audit} length={audit.data?.length || 0} />
      </section>
      {order && <OrderDetail id={order} onClose={() => setOrder(undefined)} />}
    </>
  );
}
