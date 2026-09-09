import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentSession } from "@/src/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reason = searchParams.get("reason");

  await revokeCurrentSession().catch(() => null);

  const loginUrl = new URL("/login", request.url);
  if (reason === "inactivity") {
    loginUrl.searchParams.set("inactivo", "1");
  }

  const response = NextResponse.redirect(loginUrl);
  // Evitar almacenamiento en caché para proteger claves y datos de sesión
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
