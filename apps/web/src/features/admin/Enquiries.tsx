"use client";
import { useState } from "react";
import { api, human, type Schemas } from "@/lib/api";
import { DataForm } from "@/components/Form";
import Dialog from "@/components/Dialog";
import {
  useList,
  useRefresh,
  Pagination,
  ErrorMessage,
  Empty,
  field,
  statusOptions,
} from "./shared";
export default function Enquiries() {
  const list = useList<Schemas["Enquiry"]>("/api/v1/admin/enquiries"),
    assignees = useList<{ id: string; name: string }>(
      "/api/v1/admin/assignees",
    ),
    refresh = useRefresh();
  const [selected, setSelected] = useState<Schemas["Enquiry"]>(),
    [adding, setAdding] = useState(false),
    [notes, setNotes] = useState<Schemas["Note"][]>([]);
  async function open(e: Schemas["Enquiry"]) {
    setSelected(e);
    setNotes(
      await api<Schemas["Note"][]>(
        "get",
        "/api/v1/admin/enquiries/{enquiryId}/notes",
        undefined,
        { enquiryId: e.id },
      ),
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CONVERSATION</div>
          <h1>Lovely things start here.</h1>
          <p className="sub">
            Event wishes, thoughtful gifts and conversations to come back to.
          </p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}>
          + Add enquiry
        </button>
      </div>
      <ErrorMessage error={list.error} />
      <section className="card table-card">
        <div className="table-scroll" tabIndex={0} aria-label="Enquiries table">
          <table>
            <thead>
              <tr>
                {["Contact", "Source", "Message", "Status", ""].map((x, i) => (
                  <th key={i}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.contact.name}
                    <small className="member-contact">{e.contact.email}</small>
                  </td>
                  <td>{human(e.source)}</td>
                  <td className="wrap-cell">{e.message}</td>
                  <td>
                    <span className="status-chip">{human(e.status)}</span>
                  </td>
                  <td>
                    <button className="btn" onClick={() => open(e)}>
                      Open enquiry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.data?.length && <Empty>No conversations waiting yet.</Empty>}
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      {adding && (
        <Dialog
          title="Add enquiry"
          className="drawer"
          onClose={() => setAdding(false)}
        >
          <h2>Start a conversation.</h2>
          <DataForm
            submit="Save enquiry"
            fields={[
              field("name", "Contact name", "", true),
              field("email", "Contact email", "", true, "email"),
              field("phone", "Phone number", "", true),
              {
                name: "source",
                label: "Channel",
                required: true,
                options: statusOptions([
                  "whatsapp",
                  "instagram",
                  "phone",
                  "website",
                  "event",
                ]),
              },
              field("message", "Message", "", true, "textarea"),
            ]}
            onSubmit={async (d) => {
              await api("post", "/api/v1/admin/enquiries", {
                contact: { name: d.name, email: d.email, phone: d.phone },
                source: d.source,
                message: d.message,
              });
              setAdding(false);
              await refresh();
            }}
          />
        </Dialog>
      )}
      {selected && (
        <Dialog
          title="Enquiry details"
          className="drawer"
          onClose={() => setSelected(undefined)}
        >
          <h2>{selected.contact.name}</h2>
          <p>
            {selected.contact.email}
            <br />
            {selected.contact.phone}
          </p>
          <p className="enquiry-message">{selected.message}</p>
          <DataForm
            submit="Save follow-up status"
            fields={[
              {
                name: "status",
                label: "Follow-up status",
                value: selected.status,
                required: true,
                options: statusOptions(["new", "in_progress", "closed"]),
              },
              {
                name: "assigned_to",
                label: "Assigned team member",
                value: selected.assigned_to || "",
                options: [
                  { value: "", label: "Unassigned" },
                  ...(assignees.data || []).map((a) => ({
                    value: a.id,
                    label: a.name,
                  })),
                ],
              },
            ]}
            onSubmit={async (d) => {
              const e = await api<Schemas["Enquiry"]>(
                "patch",
                "/api/v1/admin/enquiries/{enquiryId}",
                {
                  expected_version: selected.version,
                  status: d.status,
                  assigned_to: d.assigned_to || null,
                },
                { enquiryId: selected.id },
              );
              setSelected(e);
              await refresh();
            }}
          />
          <h2 className="section-label">Internal notes</h2>
          {notes.map((n) => (
            <div className="detail-block" key={n.id}>
              <p>{n.body}</p>
              <small>
                {new Date(n.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </small>
            </div>
          ))}
          <DataForm
            submit="Add internal note"
            fields={[field("body", "Note", "", true, "textarea")]}
            onSubmit={async (d) => {
              await api(
                "post",
                "/api/v1/admin/enquiries/{enquiryId}/notes",
                d,
                { enquiryId: selected.id },
              );
              await open(selected);
            }}
          />
          <p className="permission">
            Notes remain inside the studio. No customer message is sent.
          </p>
        </Dialog>
      )}
    </>
  );
}
