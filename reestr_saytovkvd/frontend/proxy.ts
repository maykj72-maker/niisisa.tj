import { NextRequest, NextResponse } from "next/server";

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
if (process.env.NODE_ENV === "production" && !configuredApiBase) {
  throw new Error("NEXT_PUBLIC_API_BASE must be configured for production.");
}
const apiBase = configuredApiBase || "http://localhost:8000/api";
const isProduction = process.env.NODE_ENV === "production";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const configuredApiUrl = new URL(apiBase);
if (isProduction && configuredApiUrl.protocol !== "https:") {
  throw new Error("NEXT_PUBLIC_API_BASE must use HTTPS in production.");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const apiUrl = new URL(configuredApiUrl);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const requestHostname = forwardedHost
    ? new URL(`http://${forwardedHost}`).hostname
    : request.nextUrl.hostname;
  if (
    !isProduction
    && localHosts.has(requestHostname)
    && localHosts.has(apiUrl.hostname)
  ) {
    apiUrl.hostname = requestHostname;
  }
  const apiOrigin = apiUrl.origin;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiOrigin} https:`,
    `media-src 'self' blob: ${apiOrigin} https:`,
    `connect-src 'self' ${apiOrigin}${isProduction ? "" : " ws://localhost:3000"}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
