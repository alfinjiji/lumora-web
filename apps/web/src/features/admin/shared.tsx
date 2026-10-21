"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Endpoint, type Schemas } from "@/lib/api";
import type { Field } from "@/components/Form";
export function useList<T>(
  path: Endpoint,
  enabled = true,
  filters: Record<string, string> = {},
) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [path, page, filters],
    enabled,
    queryFn: () =>
      api<T[]>("get", path, undefined, undefined, undefined, {
        page: String(page),
        ...filters,
      }),
  });
  return { ...query, page, setPage };
}
export function Pagination({
  page,
  setPage,
  length,
}: {
  page: number;
  setPage: (page: number) => void;
  length: number;
}) {
  return (
    <div className="table-footer">
      <button
        className="btn"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        ← Previous
      </button>
      <span>Page {page}</span>
      <button
        className="btn"
        disabled={length < 20}
        onClick={() => setPage(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="notice">
      {error instanceof Error ? error.message : "Could not load these records."}
    </p>
  ) : null;
}
export function useRefresh() {
  const q = useQueryClient();
  return () => q.invalidateQueries();
}
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Schemas["User"]>("get", "/api/v1/me"),
  });
}
export const field = (
  name: string,
  label: string,
  value = "",
  required = false,
  type = "text",
): Field => ({ name, label, value, required, type });
export const statusOptions = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export function minor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use an INR amount with up to two decimal places.");
  const [w, f = ""] = value.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}
