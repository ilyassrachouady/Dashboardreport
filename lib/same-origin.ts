// Use the browser-facing Host as well as the URL fallback: local reverse proxies
// can give a Request URL hostname that differs from the actual public hostname.
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = new URL(request.url), supplied = new URL(origin);
    return supplied.protocol === expected.protocol && supplied.host === (request.headers.get("host") || expected.host);
  } catch { return false; }
}
