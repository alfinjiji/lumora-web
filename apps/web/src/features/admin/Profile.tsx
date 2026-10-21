"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { api, upload } from "@/lib/api";
import { DataForm } from "@/components/Form";
import { useMe, useRefresh, field } from "./shared";
export default function Profile() {
  const { data: u } = useMe(),
    refresh = useRefresh(),
    [message, setMessage] = useState("");
  if (!u) return null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR ACCOUNT</div>
          <h1>A space that’s yours.</h1>
          <p className="sub">
            Manage your profile, photo and account security.
          </p>
        </div>
      </div>
      <div className="account-grid">
        <section className="card account-card">
          <h2>Personal details</h2>
          <p className="sub">The name and photo your team will see.</p>
          <div className="photo-editor">
            <div className="account-photo">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="Your profile photograph" />
              ) : (
                u.name[0]
              )}
            </div>
            <div>
              <label className="field-row">
                Upload photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    try {
                      if (e.target.files?.[0]) {
                        const m = await upload(e.target.files[0], "avatar");
                        await api("put", "/api/v1/me/avatar", {
                          media_id: m.id,
                        });
                        await refresh();
                      }
                    } catch (err) {
                      setMessage((err as Error).message);
                    }
                  }}
                />
              </label>
              <div className="photo-help">JPG, PNG or WebP · Up to 2 MB</div>
              {u.avatar_url && (
                <button
                  className="btn"
                  onClick={async () => {
                    await api("delete", "/api/v1/me/avatar");
                    await refresh();
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <p>{u.email}</p>
          <DataForm
            key={u.version}
            fields={[
              field("name", "Display name", u.name, true),
              field("phone", "Phone number", u.phone || ""),
              field("bio", "About you", u.bio || "", false, "textarea"),
            ]}
            onSubmit={async (d) => {
              await api("patch", "/api/v1/me", {
                ...d,
                expected_version: u.version,
              });
              await refresh();
            }}
          />
        </section>
        <section className="card account-card">
          <h2>Password & security</h2>
          <p className="sub">Keep your studio account personal to you.</p>
          <DataForm
            submit="Update password"
            fields={[
              field(
                "current_password",
                "Current password",
                "",
                true,
                "password",
              ),
              field("password", "New password", "", true, "password"),
              field(
                "password_confirmation",
                "Confirm new password",
                "",
                true,
                "password",
              ),
            ]}
            onSubmit={async (d) => {
              await api("put", "/api/v1/me/password", d);
            }}
          />
          <div className="detail-block">
            <h3>Change email</h3>
            <DataForm
              submit="Verify new email"
              fields={[
                field("email", "New email address", "", true, "email"),
                field(
                  "current_password",
                  "Current password",
                  "",
                  true,
                  "password",
                ),
              ]}
              onSubmit={async (d) => {
                await api("post", "/api/v1/me/email-change", d);
              }}
            />
          </div>
          <div className="detail-block">
            <h3>Assigned role</h3>
            <span className="status-chip">
              {u.staff_role === "owner" ? "Owner" : "Fulfillment staff"}
            </span>
            <p className="permission">
              Roles are assigned to your account. Ask the owner to change your
              studio access.
            </p>
          </div>
        </section>
      </div>
      <p role="status">{message}</p>
    </>
  );
}
