"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { api, upload, ApiFailure, type Schemas } from "@/lib/api";
import { useList, useRefresh, ErrorMessage } from "./shared";
export default function Content() {
  const [message, setMessage] = useState("");
  const {
    data: c,
    error,
    isPending,
  } = useQuery({
    queryKey: ["content"],
    queryFn: () => api<Schemas["Content"]>("get", "/api/v1/admin/content/home"),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LITTLE WORLD, ONLINE</div>
          <h1>Set a lovely scene.</h1>
          <p className="sub">
            Thoughtful words and photographs for the first impression.
          </p>
        </div>
      </div>
      {isPending ? (
        <p role="status">Opening website content…</p>
      ) : error && !(error instanceof ApiFailure && error.status === 404) ? (
        <ErrorMessage error={error} />
      ) : (
        <ContentEditor
          key={c?.version || 0}
          content={c}
          onMessage={setMessage}
        />
      )}
      <p role="status">{message}</p>
    </>
  );
}
function ContentEditor({
  content: c,
  onMessage: setMessage,
}: {
  content?: Schemas["Content"];
  onMessage: (message: string) => void;
}) {
  const refresh = useRefresh(),
    collections = useList<Schemas["Collection"]>("/api/v1/admin/collections"),
    [image, setImage] = useState(c?.hero.image_media_id || null),
    [busy, setBusy] = useState(false);
  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      heading: c?.hero.heading || "A little light. A slower moment.",
      subtitle:
        c?.hero.subtitle ||
        "Candles for quiet evenings, thoughtful gifts, and the moments you want to hold onto.",
      cta_label: c?.hero.cta_label || "Find your glow",
      cta_path: c?.hero.cta_path || "/#collection",
      announcement: c?.announcement || "A LITTLE LIGHT. A LITTLE LESS HURRY.",
      featured_collection_id: c?.featured_collection_id || "",
    },
  });
  const values = useWatch({ control });
  return (
    <div className="content-grid">
      <section className="card settings">
        <h2>Home page details</h2>
        <form
          className="form"
          onSubmit={handleSubmit(async (d) => {
            setBusy(true);
            try {
              await api("put", "/api/v1/admin/content/home", {
                expected_version: c?.version || 1,
                hero: {
                  heading: d.heading,
                  subtitle: d.subtitle,
                  cta_label: d.cta_label,
                  cta_path: d.cta_path,
                  image_media_id: image,
                },
                announcement: d.announcement,
                featured_collection_id: d.featured_collection_id || null,
              });
              await refresh();
              setMessage("Draft saved. The published website is unchanged.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          })}
        >
          {[
            ["heading", "Hero headline"],
            ["subtitle", "Hero subtitle"],
            ["cta_label", "Button label"],
            ["cta_path", "Button destination"],
            ["announcement", "Announcement"],
          ].map(([name, label]) => (
            <div className="field-row" key={name}>
              <label htmlFor={"content-" + name}>{label}</label>
              {name === "subtitle" ? (
                <textarea
                  id={"content-" + name}
                  className="field"
                  rows={4}
                  {...register(name as keyof typeof values, { required: true })}
                />
              ) : (
                <input
                  id={"content-" + name}
                  className="field"
                  {...register(name as keyof typeof values, { required: true })}
                />
              )}
            </div>
          ))}
          <label className="field-row">
            Featured collection
            <select className="field" {...register("featured_collection_id")}>
              <option value="">No featured collection</option>
              {collections.data
                ?.filter((c) => c.status === "active")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-row">
            Campaign photograph
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                try {
                  if (e.target.files?.[0]) {
                    const m = await upload(e.target.files[0], "content_image");
                    setImage(m.id);
                  }
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            />
          </label>
          {image && (
            <button
              type="button"
              className="btn"
              onClick={() => setImage(null)}
            >
              Remove campaign photograph
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save draft"}
          </button>
        </form>
        {c && (
          <div className="inline-actions">
            <button
              className="btn primary"
              disabled={busy || c.status === "published"}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(
                    "post",
                    "/api/v1/admin/content/home/publish",
                    { expected_version: c.version },
                    undefined,
                    crypto.randomUUID(),
                  );
                  await refresh();
                  setMessage("The saved draft is now published.");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish saved draft
            </button>
            <span className="status-chip">
              {c.status} · revision {c.version}
            </span>
          </div>
        )}
        <p className="permission">
          Save your changes as a draft before publishing. The preview follows
          the text you are editing.
        </p>
      </section>
      <section>
        <div className="eyebrow">A LITTLE PREVIEW</div>
        <div className="announcement-preview">{values.announcement}</div>
        <div className="hero-preview">
          <div>
            <div className="eyebrow">FOR THE BEAUTY OF EVERYDAY</div>
            <h2>{values.heading}</h2>
            <p>{values.subtitle}</p>
            <span className="preview-cta">{values.cta_label} ↗</span>
          </div>
          <div className="art">
            <img
              src={image ? "/media/" + image : "/images/design/hero.webp"}
              alt="Campaign preview"
            />
          </div>
        </div>
        <p className="sub preview-caption">
          Private preview · content grows naturally with your copy.
        </p>
      </section>
    </div>
  );
}
