"use client";
import { useState } from "react";
import { api, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import Dialog from "@/components/Dialog";
import { useList, useRefresh, ErrorMessage, Pagination, field } from "./shared";
export default function Team() {
  const list = useList<Schemas["Member"]>("/api/v1/admin/team"),
    invitations = useList<Schemas["Invitation"]>("/api/v1/admin/invitations"),
    refresh = useRefresh();
  const [selected, setSelected] = useState<Schemas["Member"] | null>(),
    [message, setMessage] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE PEOPLE BEHIND THE GLOW</div>
          <h1>A thoughtful little team.</h1>
          <p className="sub">
            Give everyone the right amount of room to do lovely work.
          </p>
        </div>
        <button className="btn primary" onClick={() => setSelected(null)}>
          + Invite team member
        </button>
      </div>
      <ErrorMessage error={list.error} />
      <section className="card table-card">
        <div className="table-scroll" tabIndex={0} aria-label="Team table">
          <table>
            <thead>
              <tr>
                {["Team member", "Role", "Status", ""].map((x, i) => (
                  <th key={i}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.user.name}
                    <small className="member-contact">{m.user.email}</small>
                  </td>
                  <td>{m.role === "owner" ? "Owner" : "Fulfillment staff"}</td>
                  <td>{m.active ? "Active" : "Inactive"}</td>
                  <td>
                    <button className="btn" onClick={() => setSelected(m)}>
                      Manage access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      <section className="card card-body" style={{ marginTop: 24 }}>
        <h2>Invitations</h2>
        <p className="sub">
          Secure setup links expire and can be used once. This environment
          prepares private email previews; external delivery remains disabled.
        </p>
        {invitations.data?.map((i) => (
          <div className="detail-line" key={i.id}>
            <span>
              {i.email} · {i.role} · {i.status}
            </span>
            {i.status === "pending" && (
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await api(
                      "post",
                      "/api/v1/admin/invitations/{invitationId}/revoke",
                      undefined,
                      { invitationId: i.id },
                    );
                    await refresh();
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Revoke invitation
              </button>
            )}
          </div>
        ))}
      </section>
      <p role="status">{message}</p>
      {selected !== undefined && (
        <Dialog
          title="Team access"
          className="drawer"
          onClose={() => setSelected(undefined)}
        >
          <h2>
            {selected ? selected.user.name : "Make room for someone new."}
          </h2>
          <DataForm
            submit={selected ? "Save access" : "Prepare secure invitation"}
            fields={[
              ...(!selected
                ? [
                    field("name", "Full name", "", true),
                    field("email", "Email address", "", true, "email"),
                  ]
                : []),
              {
                name: "role",
                label: "Access role",
                value: selected?.role || "",
                required: true,
                options: [
                  { value: "owner", label: "Owner" },
                  { value: "fulfillment", label: "Fulfillment staff" },
                ],
              },
              ...(selected
                ? [
                    {
                      name: "active",
                      label: "Membership status",
                      value: String(selected.active),
                      options: [
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" },
                      ],
                    },
                  ]
                : []),
            ]}
            onSubmit={async (d) => {
              if (selected)
                await api(
                  "patch",
                  "/api/v1/admin/team/{memberId}",
                  {
                    expected_version: selected.version,
                    role: d.role,
                    active: d.active === "true",
                  },
                  { memberId: selected.id },
                );
              else await api("post", "/api/v1/admin/invitations", d);
              setSelected(undefined);
              await refresh();
            }}
          />
          <p className="permission">
            Owners manage prices, payments, publishing and team access.
            Fulfillment staff manage orders, stock and enquiries. The final
            active owner is protected.
          </p>
        </Dialog>
      )}
    </>
  );
}
