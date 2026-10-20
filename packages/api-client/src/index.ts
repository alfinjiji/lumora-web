import createClient from "openapi-fetch";
import type { paths, components } from "./schema";
export type Schemas = components["schemas"];
export type { paths };
export const createApiClient = (baseUrl = "") =>
  createClient<paths>({ baseUrl, credentials: "include", cache: "no-store" });
