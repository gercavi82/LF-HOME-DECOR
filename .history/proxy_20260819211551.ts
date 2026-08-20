import { updateSession } from "@/src/lib/supabase/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/ventas/:path*",
    "/productos/:path*",
    "/inventario/:path*",
    "/usuarios/:path*",
    "/reportes/:path*",
    "/configuracion/:path*",
    "/cambiar-password/:path*",
  ],
};