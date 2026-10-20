"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, money, upload, type Schemas } from "@/lib/api";
import { ShopHeader } from "@/features/catalog/Storefront";
import Dialog from "@/components/Dialog";
import { DataForm } from "@/components/Form";
export default function AccountPage() {
  const router = useRouter(),
    q = useQueryClient(),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<Schemas["Address"]>();
  const {
    data: u,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Schemas["User"]>("get", "/api/v1/me"),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["own-orders"],
    queryFn: () => api<Schemas["Order"][]>("get", "/api/v1/me/orders"),
    enabled: !!u,
  });
  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Schemas["Address"][]>("get", "/api/v1/me/addresses"),
    enabled: !!u,
  });
  return (
    <>
      <ShopHeader />
      <main className="app-section">
        <h1>
          Your little <em>world.</em>
        </h1>
        {isLoading ? (
          <p>Opening your account…</p>
        ) : error || !u ? (
          <p>
            <Link className="button" href="/login">
              Sign in to your account ↗
            </Link>
          </p>
        ) : (
          <>
            <div className="inline-actions">
              <span>{u.email}</span>
              {u.staff_role && <Link href="/admin">Open the studio ↗</Link>}
              <button
                className="text-link"
                onClick={async () => {
                  await api("post", "/auth/logout");
                  q.clear();
                  router.replace("/");
                }}
              >
                Sign out
              </button>
            </div>
            {!u.email_verified && (
              <p className="notice">
                Verify your email to claim guest orders.{" "}
                <button
                  onClick={async () => {
                    await api("post", "/auth/email-verification/request");
                    setMessage("Verification link requested.");
                  }}
                >
                  Request verification link
                </button>
              </p>
            )}
            <h2>Your orders</h2>
            {orders.length ? (
              orders.map((o) => (
                <Link
                  className="order-card"
                  style={{ display: "block" }}
                  href={"/orders/" + o.id}
                  key={o.id}
                >
                  {o.number} · {o.status.replaceAll("_", " ")} ·{" "}
                  {money(o.total_minor)}
                </Link>
              ))
            ) : (
              <p>Your order history is ready for a lovely beginning.</p>
            )}
            <h2>Personal details</h2>
            <DataForm
              key={u.version}
              fields={[
                {
                  name: "name",
                  label: "Display name",
                  value: u.name,
                  required: true,
                },
                { name: "phone", label: "Phone number", value: u.phone || "" },
                {
                  name: "bio",
                  label: "About you",
                  type: "textarea",
                  value: u.bio || "",
                },
              ]}
              onSubmit={async (d) => {
                await api("patch", "/api/v1/me", {
                  expected_version: u.version,
                  ...d,
                });
                await q.invalidateQueries({ queryKey: ["me"] });
              }}
            />
            <label className="field-row">
              Profile photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  try {
                    if (!e.target.files?.[0]) return;
                    const m = await upload(e.target.files[0], "avatar");
                    await api("put", "/api/v1/me/avatar", { media_id: m.id });
                    q.invalidateQueries({ queryKey: ["me"] });
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
                }}
              />
            </label>
            {u.avatar_url && (
              <button
                className="text-link"
                onClick={async () => {
                  await api("delete", "/api/v1/me/avatar");
                  q.invalidateQueries({ queryKey: ["me"] });
                }}
              >
                Remove photo
              </button>
            )}
            <h2>Saved addresses</h2>
            {addresses.map((a) => (
              <div className="order-card" key={a.id}>
                <p>
                  {a.line1}, {a.city}, {a.postcode}
                </p>
                <button className="text-link" onClick={() => setEditing(a)}>
                  Edit address
                </button>
                <button
                  className="text-link"
                  onClick={async () => {
                    await api(
                      "delete",
                      "/api/v1/me/addresses/{addressId}",
                      undefined,
                      { addressId: a.id },
                    );
                    q.invalidateQueries({ queryKey: ["addresses"] });
                  }}
                >
                  Remove address
                </button>
              </div>
            ))}
            <DataForm
              submit="Save new address"
              fields={[
                { name: "line1", label: "Address line 1", required: true },
                { name: "line2", label: "Address line 2" },
                { name: "city", label: "City", required: true },
                { name: "postcode", label: "PIN code", required: true },
              ]}
              onSubmit={async (d) => {
                await api("post", "/api/v1/me/addresses", {
                  ...d,
                  state_code: "KL",
                  country_code: "IN",
                });
                q.invalidateQueries({ queryKey: ["addresses"] });
              }}
            />
            {editing && (
              <Dialog
                title="Edit saved address"
                onClose={() => setEditing(undefined)}
              >
                <h2>Edit saved address</h2>
                <DataForm
                  fields={[
                    {
                      name: "line1",
                      label: "Address line 1",
                      value: editing.line1,
                      required: true,
                    },
                    {
                      name: "line2",
                      label: "Address line 2",
                      value: editing.line2 || "",
                    },
                    {
                      name: "city",
                      label: "City",
                      value: editing.city,
                      required: true,
                    },
                    {
                      name: "postcode",
                      label: "PIN code",
                      value: editing.postcode,
                      required: true,
                    },
                  ]}
                  onSubmit={async (d) => {
                    await api(
                      "put",
                      "/api/v1/me/addresses/{addressId}",
                      { ...d, state_code: "KL", country_code: "IN" },
                      { addressId: editing.id },
                    );
                    await q.invalidateQueries({ queryKey: ["addresses"] });
                    setEditing(undefined);
                  }}
                />
              </Dialog>
            )}
            <h2>Password & security</h2>
            <DataForm
              submit="Update password"
              fields={[
                {
                  name: "current_password",
                  label: "Current password",
                  type: "password",
                  required: true,
                },
                {
                  name: "password",
                  label: "New password",
                  type: "password",
                  required: true,
                },
                {
                  name: "password_confirmation",
                  label: "Confirm new password",
                  type: "password",
                  required: true,
                },
              ]}
              onSubmit={async (d) => {
                await api("put", "/api/v1/me/password", d);
              }}
            />
            <h2>Change email</h2>
            <DataForm
              submit="Verify new email"
              fields={[
                {
                  name: "email",
                  label: "New email",
                  type: "email",
                  required: true,
                },
                {
                  name: "current_password",
                  label: "Current password",
                  type: "password",
                  required: true,
                },
              ]}
              onSubmit={async (d) => {
                await api("post", "/api/v1/me/email-change", d);
              }}
            />
          </>
        )}
        <p role="status">{message}</p>
      </main>
    </>
  );
}
