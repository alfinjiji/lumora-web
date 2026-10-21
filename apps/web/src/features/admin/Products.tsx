"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money, upload, type Schemas } from "@/lib/api";
import Dialog from "@/components/Dialog";
import { DataForm } from "@/components/Form";
import {
  useList,
  useMe,
  useRefresh,
  ErrorMessage,
  Empty,
  Pagination,
  field,
  statusOptions,
  minor,
} from "./shared";
export default function Products() {
  const list = useList<Schemas["Product"]>("/api/v1/admin/products"),
    { data: u } = useMe();
  const [selected, setSelected] = useState<string>(),
    [create, setCreate] = useState(false);
  const refresh = useRefresh();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE THINGS YOU MAKE</div>
          <h1>Your candle collection.</h1>
          <p className="sub">
            Thoughtful details, ready for their next lovely home.
          </p>
        </div>
        {u?.staff_role === "owner" && (
          <button className="btn primary" onClick={() => setCreate(true)}>
            + Add candle
          </button>
        )}
      </div>
      <ErrorMessage error={list.error} />
      <div className="catalogue">
        {list.data?.map((p) => (
          <button
            className="product-card"
            key={p.id}
            onClick={() => setSelected(p.id)}
          >
            <div className="art">
              {p.images[0]?.url ? (
                <img src={p.images[0].url} alt={p.title} />
              ) : (
                <div className="empty-state">Add a product photograph</div>
              )}
            </div>
            <div className="product-info">
              <h2>{p.title}</h2>
              <div className="product-meta">
                <span>{p.status}</span>
                <strong>
                  {p.variants.length
                    ? money(Math.min(...p.variants.map((v) => v.price_minor)))
                    : "No variants yet"}
                </strong>
              </div>
            </div>
          </button>
        ))}
      </div>
      {list.data?.length === 0 && (
        <Empty>
          Your collection starts here. Add a draft candle, its real photographs
          and variants.
        </Empty>
      )}
      <Pagination {...list} length={list.data?.length || 0} />
      {create && (
        <Dialog
          title="Add candle"
          className="drawer"
          onClose={() => setCreate(false)}
        >
          <div className="eyebrow">A NEW LITTLE LOVELY</div>
          <h2>Add a candle.</h2>
          <DataForm
            submit="Create draft candle"
            fields={[
              field("title", "Product name", "", true),
              field("slug", "Page slug", "", true),
              field("description", "Description", "", true, "textarea"),
            ]}
            onSubmit={async (d) => {
              const p = await api<Schemas["Product"]>(
                "post",
                "/api/v1/admin/products",
                { ...d, status: "draft", scent_notes: [] },
              );
              await refresh();
              setCreate(false);
              setSelected(p.id);
            }}
          />
        </Dialog>
      )}
      {selected && (
        <ProductEditor
          id={selected}
          owner={u?.staff_role === "owner"}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}
function ProductEditor({
  id,
  owner,
  onClose,
}: {
  id: string;
  owner: boolean;
  onClose: () => void;
}) {
  const refresh = useRefresh(),
    [message, setMessage] = useState("");
  const { data: p, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () =>
      api<Schemas["Product"]>(
        "get",
        "/api/v1/admin/products/{productId}",
        undefined,
        { productId: id },
      ),
  });
  const collections = useList<Schemas["Collection"]>(
    "/api/v1/admin/collections",
    owner,
  );
  const [variant, setVariant] = useState<Schemas["Variant"]>(),
    [adding, setAdding] = useState(false);
  return (
    <Dialog title="Candle details" className="drawer" onClose={onClose}>
      <ErrorMessage error={error} />
      {p && (
        <>
          <div className="eyebrow">THE CANDLE DETAILS</div>
          <h2>{p.title}</h2>
          {owner ? (
            <>
              <DataForm
                key={"p" + p.version}
                fields={[
                  field("title", "Product name", p.title, true),
                  field("slug", "Page slug", p.slug, true),
                  field(
                    "description",
                    "Description",
                    p.description,
                    true,
                    "textarea",
                  ),
                  field(
                    "scent_notes",
                    "Scent notes, separated by commas",
                    p.scent_notes?.join(", ") || "",
                  ),
                  {
                    name: "status",
                    label: "Status",
                    value: p.status,
                    options: statusOptions(["draft", "active", "archived"]),
                  },
                ]}
                onSubmit={async (d) => {
                  await api(
                    "patch",
                    "/api/v1/admin/products/{productId}",
                    {
                      ...d,
                      expected_version: p.version,
                      scent_notes: d.scent_notes
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                    { productId: id },
                  );
                  await refresh();
                }}
              />
              <h2 className="section-label">Photographs</h2>
              <label className="field-row">
                Upload product photograph
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    try {
                      if (!e.target.files?.[0]) return;
                      const m = await upload(
                        e.target.files[0],
                        "product_image",
                      );
                      await api(
                        "post",
                        "/api/v1/admin/products/{productId}/images",
                        {
                          expected_version: p.version,
                          media_id: m.id,
                          alt: p.title,
                          sort_order: p.images.length,
                        },
                        { productId: id },
                      );
                      await refresh();
                    } catch (err) {
                      setMessage((err as Error).message);
                    }
                  }}
                />
              </label>
              {p.images.map((m) => (
                <div className="inline-actions" key={m.id}>
                  {m.url && (
                    <img
                      src={m.url}
                      width={80}
                      height={90}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                      alt={p.title}
                    />
                  )}
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        await api(
                          "delete",
                          "/api/v1/admin/products/{productId}/images/{mediaId}",
                          { expected_version: p.version },
                          { productId: id, mediaId: m.id },
                        );
                        await refresh();
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    Remove photograph
                  </button>
                </div>
              ))}
              <h2 className="section-label">Collections</h2>
              {collections.data?.map((c) => (
                <label key={c.id} className="inline-actions">
                  <input
                    type="checkbox"
                    checked={p.collection_ids?.includes(c.id) || false}
                    onChange={async (e) => {
                      try {
                        const ids = e.target.checked
                          ? [...(p.collection_ids || []), c.id]
                          : (p.collection_ids || []).filter((x) => x !== c.id);
                        await api(
                          "patch",
                          "/api/v1/admin/products/{productId}",
                          { expected_version: p.version, collection_ids: ids },
                          { productId: id },
                        );
                        await refresh();
                      } catch (err) {
                        setMessage((err as Error).message);
                      }
                    }}
                  />
                  {c.title}
                </label>
              ))}
            </>
          ) : (
            <p>{p.description}</p>
          )}
          <h2 className="section-label">Variants & prices</h2>
          {p.variants.map((v) => (
            <div className="detail-line" key={v.id}>
              <span>
                {v.sku} · {v.options.map((o) => o.value).join(" / ")} ·{" "}
                {v.active ? "Active" : "Inactive"}
              </span>
              <strong>{money(v.price_minor)}</strong>
              {owner && (
                <button className="btn" onClick={() => setVariant(v)}>
                  Edit variant
                </button>
              )}
            </div>
          ))}
          {owner && (
            <button className="btn" onClick={() => setAdding(true)}>
              + Add variant
            </button>
          )}
          <p role="status">{message}</p>
          {(adding || variant) && (
            <div className="variant-editor">
              <h2>{variant ? "Edit variant" : "New variant"}</h2>
              <DataForm
                key={variant?.id || "new"}
                submit="Save variant"
                fields={[
                  field("sku", "SKU", variant?.sku || "", true),
                  field(
                    "price",
                    "Price in INR",
                    String((variant?.price_minor || 0) / 100),
                    true,
                  ),
                  field(
                    "option_name",
                    "Option name (for example Colour)",
                    variant?.options[0]?.name || "",
                  ),
                  field(
                    "option_value",
                    "Option value",
                    variant?.options[0]?.value || "",
                  ),
                  field(
                    "option_name_2",
                    "Second option name",
                    variant?.options[1]?.name || "",
                  ),
                  field(
                    "option_value_2",
                    "Second option value",
                    variant?.options[1]?.value || "",
                  ),
                  {
                    name: "active",
                    label: "Variant availability",
                    value: String(variant?.active ?? true),
                    options: statusOptions(["true", "false"]),
                  },
                ]}
                onSubmit={async (d) => {
                  const options = [
                    d.option_name && d.option_value
                      ? { name: d.option_name, value: d.option_value }
                      : null,
                    d.option_name_2 && d.option_value_2
                      ? { name: d.option_name_2, value: d.option_value_2 }
                      : null,
                    ...(variant?.options.slice(2) || []),
                  ].filter(Boolean);
                  const data = {
                    sku: d.sku,
                    price_minor: minor(d.price),
                    options,
                    active: d.active === "true",
                  };
                  if (variant)
                    await api(
                      "patch",
                      "/api/v1/admin/variants/{variantId}",
                      { ...data, expected_version: variant.version },
                      { variantId: variant.id },
                    );
                  else
                    await api(
                      "post",
                      "/api/v1/admin/products/{productId}/variants",
                      data,
                      { productId: id },
                    );
                  setVariant(undefined);
                  setAdding(false);
                  await refresh();
                }}
              />
              <button
                className="btn"
                onClick={() => {
                  setAdding(false);
                  setVariant(undefined);
                }}
              >
                Cancel variant edit
              </button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
