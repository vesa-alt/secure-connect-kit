// Adapter: turn the fetch-style handler into Node/Express/Connect middleware.
import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: Request) => Promise<Response | null>;

export function toNodeMiddleware(handler: Handler) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
      method: req.method ?? "GET",
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? null : new Uint8Array(Buffer.concat(chunks)),
    });
    const response = await handler(request);
    if (!response) return next();
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}
