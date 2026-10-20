"use client";
import { useState } from "react";
import { api, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import Dialog from "@/components/Dialog";
import {
  useList,
  useRefresh,
  useMe,
  ErrorMessage,
  Pagination,
  Empty,
  field,
} from "./shared";
export default function Inventory() {
  const list = useList<Schemas["Inventory"]>("/api/v1/admin/inventory"),
    { data: u } = useMe(),
    refresh = useRefresh();
  const [selected, setSelected] = useState<Schemas["Inventory"]>();
  const [history, setHistory] = useState<Schemas["Movement"][]>([]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CARE FOR YOUR STOCK</div>
          <h1>Keep the glow going.</h1>
          <p className="sub">
            Ready stock, thoughtful adjustments and a clear history.
          </p>
        </div>
      </div>
      <ErrorMessage error={list.error} />
      <section className="card table-card">
        <div className="table-scroll" tabIndex={0} aria-label="Inventory table">
          <table>
            <thead>
              <tr>
                {[
                  "SKU",
                  "On hand",
                  "Reserved",
                  "Available",
                  "Low stock at",
                  "",
                ].map((x, i) => (
                  <th key={i}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((b) => (
                <tr key={b.variant_id}>
                  <td>{b.sku}</td>
                  <td>{b.on_hand}</td>
                  <td>{b.reserved}</td>
                  <td>
                    <span className="status-chip">{b.available}</span>
                  </td>
                  <td>{b.low_stock_threshold}</td>
                  <td>
                    <button
                      className="btn"
                      onClick={async () => {
                        setSelected(b);
                        setHistory(
                          await api<Schemas["Movement"][]>(
                            "get",
                            "/api/v1/admin/inventory/{variantId}/movements",
                            undefined,
                            { variantId: b.variant_id },
                          ),
                        );
                      }}
                    >
                      Adjust / history
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data?.length === 0 && (
          <Empty>Add product variants to begin tracking ready stock.</Empty>
        )}
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      {selected && (
        <Dialog
          title="Stock adjustment"
          className="drawer"
          onClose={() => setSelected(undefined)}
        >
          <h2>{selected.sku}</h2>
          <p>
            {selected.available} available · {selected.reserved} reserved
          </p>
          <DataForm
            submit="Record adjustment"
            fields={[
              field(
                "delta",
                "Quantity change (use a minus for a reduction)",
                "",
                true,
                "number",
              ),
              field("reason", "Adjustment reason", "", true, "textarea"),
            ]}
            onSubmit={async (d) => {
              await api(
                "post",
                "/api/v1/admin/inventory/{variantId}/adjustments",
                {
                  expected_version: selected.version,
                  on_hand_delta: Number(d.delta),
                  reason: d.reason,
                },
                { variantId: selected.variant_id },
                crypto.randomUUID(),
              );
              setSelected(undefined);
              await refresh();
            }}
          />
          {u?.staff_role === "owner" && (
            <DataForm
              submit="Update low-stock threshold"
              fields={[
                field(
                  "threshold",
                  "Low-stock threshold",
                  String(selected.low_stock_threshold),
                  true,
                  "number",
                ),
              ]}
              onSubmit={async (d) => {
                await api(
                  "patch",
                  "/api/v1/admin/inventory/{variantId}/threshold",
                  {
                    expected_version: selected.version,
                    low_stock_threshold: Number(d.threshold),
                  },
                  { variantId: selected.variant_id },
                );
                setSelected(undefined);
                await refresh();
              }}
            />
          )}
          <h2 className="section-label">Adjustment history</h2>
          {history.map((m) => (
            <div className="detail-block" key={m.id}>
              <strong>
                {m.on_hand_delta > 0 ? "+" : ""}
                {m.on_hand_delta} physical · {m.reserved_delta > 0 ? "+" : ""}
                {m.reserved_delta} reserved
              </strong>
              <p>{m.reason}</p>
              <small>
                {new Date(m.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </small>
            </div>
          ))}
        </Dialog>
      )}
    </>
  );
}
