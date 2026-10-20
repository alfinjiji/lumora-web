"use client";
import { useState } from "react";
import { api, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import Dialog from "@/components/Dialog";
import {
  useList,
  useRefresh,
  ErrorMessage,
  Pagination,
  Empty,
  field,
  statusOptions,
} from "./shared";
export default function Delivery() {
  const list = useList<Schemas["Rule"]>("/api/v1/admin/delivery-rules"),
    refresh = useRefresh(),
    [selected, setSelected] = useState<Schemas["Rule"] | null>();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WHERE THE GLOW GOES</div>
          <h1>A little closer to home.</h1>
          <p className="sub">
            Kerala delivery areas, city controls and PIN-code exceptions.
          </p>
        </div>
        <button className="btn primary" onClick={() => setSelected(null)}>
          + Add delivery rule
        </button>
      </div>
      <div className="notice">
        An explicit PIN-code block wins. Then a PIN-code allowance, city rule
        and state rule apply in that order. An area without an applicable
        allowance is unavailable. Shipping charges are still confirmed for each
        order.
      </div>
      <ErrorMessage error={list.error} />
      <section className="card table-card">
        <div className="table-scroll" tabIndex={0} aria-label="Delivery rules">
          <table>
            <thead>
              <tr>
                {[
                  "Area type",
                  "State / city / PIN",
                  "Decision",
                  "Active",
                  "",
                ].map((s, i) => (
                  <th key={i}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((r) => (
                <tr key={r.id}>
                  <td>{r.kind}</td>
                  <td>Kerala {r.city || r.postcode || "· All cities"}</td>
                  <td>{r.allow ? "Enabled" : "Blocked"}</td>
                  <td>{r.active ? "Yes" : "No"}</td>
                  <td>
                    <button className="btn" onClick={() => setSelected(r)}>
                      Edit rule
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.data?.length && <Empty>No delivery rules are enabled.</Empty>}
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      {selected !== undefined && (
        <Dialog
          title="Delivery rule"
          className="drawer"
          onClose={() => setSelected(undefined)}
        >
          <h2>
            {selected ? "Edit delivery area." : "Enable a little more Kerala."}
          </h2>
          <DataForm
            fields={[
              {
                name: "kind",
                label: "Area type",
                value: selected?.kind || "city",
                required: true,
                options: statusOptions(["state", "city", "postcode"]),
              },
              field("city", "City name", selected?.city || ""),
              field("postcode", "PIN code", selected?.postcode || ""),
              {
                name: "allow",
                label: "Delivery availability",
                value: String(selected?.allow ?? true),
                options: [
                  { value: "true", label: "Enabled" },
                  { value: "false", label: "Blocked" },
                ],
              },
              {
                name: "active",
                label: "Rule status",
                value: String(selected?.active ?? true),
                options: [
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ],
              },
              field(
                "priority",
                "Priority",
                String(selected?.priority ?? 0),
                true,
                "number",
              ),
            ]}
            onSubmit={async (d) => {
              const data = {
                kind: d.kind,
                state_code: "KL",
                city: d.city || null,
                postcode: d.postcode || null,
                allow: d.allow === "true",
                active: d.active === "true",
                priority: Number(d.priority),
              };
              if (selected)
                await api(
                  "patch",
                  "/api/v1/admin/delivery-rules/{ruleId}",
                  { ...data, expected_version: selected.version },
                  { ruleId: selected.id },
                );
              else await api("post", "/api/v1/admin/delivery-rules", data);
              setSelected(undefined);
              await refresh();
            }}
          />
        </Dialog>
      )}
    </>
  );
}
