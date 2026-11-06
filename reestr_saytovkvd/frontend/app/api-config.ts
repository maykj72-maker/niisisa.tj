const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
const fallbackApiBase = "http://localhost:8000/api";
const apiBase = configuredApiBase || fallbackApiBase;

let parsedApiBase: URL;

try {
  parsedApiBase = new URL(apiBase);
} catch {
  throw new Error("NEXT_PUBLIC_API_BASE must be an absolute URL.");
}

if (configuredApiBase && process.env.NODE_ENV === "production") {
  if (
    parsedApiBase.protocol !== "https:"
    || !parsedApiBase.pathname.replace(/\/+$/, "").endsWith("/api")
    || parsedApiBase.username !== ""
    || parsedApiBase.password !== ""
    || parsedApiBase.search !== ""
    || parsedApiBase.hash !== ""
  ) {
    throw new Error("NEXT_PUBLIC_API_BASE must use HTTPS and end with /api in production.");
  }
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  process.env.NODE_ENV !== "production"
  && typeof window !== "undefined"
  && localHosts.has(window.location.hostname)
  && localHosts.has(parsedApiBase.hostname)
) {
  parsedApiBase.hostname = window.location.hostname;
}

export const API_BASE = parsedApiBase.toString().replace(/\/+$/, "");
