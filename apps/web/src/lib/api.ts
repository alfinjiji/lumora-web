import {
  createApiClient,
  type Schemas,
  type paths,
} from "@auraflare/api-client";
export type { Schemas };
export class ApiFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public fields: Record<string, string[]>,
    public status: number,
  ) {
    super(message);
  }
}
const client = createApiClient();
let boot: Promise<unknown> | undefined;
// Retain the operation key after a transport/5xx ambiguity so a human retry is safe.
const uncertainOperations = new Map<string, string>();
export async function csrf() {
  boot ??= client.GET("/sanctum/csrf-cookie").catch((e) => {
    boot = undefined;
    throw e;
  });
  await boot;
}
client.use({
  async onRequest({ request }) {
    request.headers.set("Accept", "application/json");
    if (!["GET", "HEAD"].includes(request.method)) {
      const token = document.cookie
        .split("; ")
        .find((v) => v.startsWith("XSRF-TOKEN="))
        ?.slice(11);
      if (token) request.headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
    }
    return request;
  },
});
export type Endpoint = keyof paths;
export async function api<T>(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: Endpoint,
  body?: unknown,
  params?: Record<string, string>,
  key?: string,
  query?: Record<string, string>,
): Promise<T> {
  if (method !== "get") await csrf();
  type Result = {
    data?: { data: T };
    error?: {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
      };
    };
    response: Response;
  };
  const request = client.request as unknown as (
    method: string,
    path: Endpoint,
    options: unknown,
  ) => Promise<Result>;
  const fingerprint = key
    ? JSON.stringify([method, path, params, body])
    : undefined;
  const operationKey = fingerprint
    ? uncertainOperations.get(fingerprint) || key
    : undefined;
  if (fingerprint && operationKey)
    uncertainOperations.set(fingerprint, operationKey);
  const result = await request(method, path, {
    params: { path: params, query },
    body,
    headers: operationKey ? { "Idempotency-Key": operationKey } : undefined,
  });
  if (fingerprint && result.response.status < 500)
    uncertainOperations.delete(fingerprint);
  if (result.error) {
    const error = result.error as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
      };
    };
    if (result.response.status === 419) boot = undefined;
    throw new ApiFailure(
      error.error?.code || "REQUEST_FAILED",
      error.error?.message || "The request could not be completed.",
      error.error?.fields || {},
      result.response.status,
    );
  }
  return (result.data as { data: T } | undefined)?.data as T;
}
export async function upload(
  file: File,
  purpose: Schemas["UploadInput"]["purpose"],
  orderId?: string,
): Promise<Schemas["Media"]> {
  await csrf();
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", purpose);
  if (orderId) form.set("order_id", orderId);
  const result = await client.POST("/api/v1/media", {
    body: form as never,
    bodySerializer: () => form,
  });
  if (result.error) throw new Error(result.error.error.message);
  return result.data!.data;
}
export const money = (minor: number | null) =>
  minor === null
    ? "Pending"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(minor / 100);
export const human = (value: string) => value.replaceAll("_", " ");
