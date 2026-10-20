import { NextRequest, NextResponse } from "next/server";

const BASIC_USER = "team";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Creator Society Reporting", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request: NextRequest) {
  // Server-to-server ingestion has its own Bearer-token authentication.
  if (request.nextUrl.pathname === "/api/ingest") {
    return NextResponse.next();
  }

  const password = process.env.REPORTING_PASSWORD;

  // Fail closed in production if the dashboard password is missing.
  if (process.env.NODE_ENV === "production" && !password) {
    return new NextResponse("Reporting access is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Keep local development convenient when no password is configured.
  if (!password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return unauthorized();

    const username = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);

    if (username !== BASIC_USER || suppliedPassword !== password) {
      return unauthorized();
    }

    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
