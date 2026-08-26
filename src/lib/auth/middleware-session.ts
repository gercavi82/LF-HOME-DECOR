import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/session";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/recuperar-password",
  "/auth/confirm",
  "/sin-permiso",
]);

/**
 * Determina si la ruta solicitada es un recurso estático o público.
 */
function isPublicOrStatic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) {
    return true;
  }

  // Recursos estáticos internos de Next.js y archivos de medios
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.includes(".") // .ico, .png, .jpg, .svg, .css, .js, etc.
  ) {
    return true;
  }

  return false;
}

/**
 * Middleware para validar cookies de sesión e interceptar accesos no autorizados.
 */
export function updateSession(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 1. Permitir recursos públicos y estáticos sin validación
  if (isPublicOrStatic(pathname)) {
    return NextResponse.next();
  }

  // 2. Comprobar existencia de cookie de sesión
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionToken?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
