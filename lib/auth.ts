import "server-only";
import { timingSafeEqual } from "node:crypto";
export function authorizeIngestion(request: Request) {
  const expected = process.env.INGEST_SECRET,
    actual = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || expected.length < 32 || !actual) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
