import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "../prototype/server/app.js";

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

const app = createApp();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function rewriteApiUrl(request: VercelRequest) {
  const currentUrl = new URL(request.url ?? "/api", "http://werra.local");
  const pathFromQuery = first(request.query?.path) ?? currentUrl.searchParams.get("path");

  if (!pathFromQuery) {
    return;
  }

  currentUrl.searchParams.delete("path");
  const search = currentUrl.searchParams.toString();
  request.url = `/api/${pathFromQuery}${search ? `?${search}` : ""}`;
}

export default function handler(request: VercelRequest, response: ServerResponse) {
  rewriteApiUrl(request);
  return app(request, response);
}
