import { createApiClient } from "@auraflare/api-client";
export const publicApi = () =>
  createApiClient(process.env.API_INTERNAL_URL || "http://127.0.0.1:8000");
