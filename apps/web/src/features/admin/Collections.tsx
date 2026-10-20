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
export default function Collections() {
  const list = useList<Schemas["Collection"]>("/api/v1/admin/collections"),
    refresh = useRefresh();
  const [selected, setSelected] = useState<Schemas["Collection"] | null>();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CONSIDERED EDIT</div>
          <h1>Collections, thoughtfully curated.</h1>
          <p className="sub">
            Arrange your candle collection for homes, gifts and lovely
            occasions.
          </p>
        </div>
        <button className="btn primary" onClick={() => setSelected(null)}>
          + Add collection
        </button>
      </div>
      <ErrorMessage error={list.error} />
      <section className="card card-body">
        {list.data?.map((c) => (
          <div className="detail-line" key={c.id}>
            <span>
              {c.title} · {c.status} · {c.product_ids.length} candles
            </span>
            <button className="btn" onClick={() => setSelected(c)}>
              Edit collection
            </button>
          </div>
        ))}
        {!list.data?.length && (
          <Empty>Your collections are ready for a thoughtful beginning.</Empty>
        )}
        <Pagination {...list} length={list.data?.length || 0} />
      </section>
      {selected !== undefined && (
        <Dialog
          title="Collection details"
          className="drawer"
          onClose={() => setSelected(undefined)}
        >
          <h2>{selected ? "Edit collection." : "A new collection."}</h2>
          <DataForm
            fields={[
              field("title", "Collection title", selected?.title || "", true),
              field("slug", "Page slug", selected?.slug || "", true),
              {
                name: "status",
                label: "Status",
                value: selected?.status || "draft",
                options: statusOptions(["draft", "active", "archived"]),
              },
            ]}
            onSubmit={async (d) => {
              if (selected)
                await api(
                  "patch",
                  "/api/v1/admin/collections/{collectionId}",
                  { ...d, expected_version: selected.version },
                  { collectionId: selected.id },
                );
              else
                await api("post", "/api/v1/admin/collections", {
                  ...d,
                  product_ids: [],
                });
              setSelected(undefined);
              await refresh();
            }}
          />
          <p className="permission">
            Choose collection membership when editing a candle.
          </p>
        </Dialog>
      )}
    </>
  );
}
