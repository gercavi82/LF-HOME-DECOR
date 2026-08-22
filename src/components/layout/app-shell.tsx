"use client";

import {
  Bell,
  Boxes,
  ChartNoAxesCombined,
  ChevronDown,
  CircleUserRound,
  House,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  ShoppingCart,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logoutAction } from "@/app/login/actions";
import { cn } from "@/src/lib/cn";

type ShellUser = {
  name: string;
  profile: string;
  initials: string;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  administratorOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { label: "Inicio", href: "/dashboard", icon: House, permissions: ["DASHBOARD_VER"] },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart, permissions: ["VENTA_VER", "VENTA_CREAR"] },
  { label: "Productos", href: "/productos", icon: PackageSearch, permissions: ["PRODUCTO_VER"] },
  { label: "Inventario", href: "/inventario", icon: Boxes, permissions: ["INVENTARIO_VER"] },
  { label: "Alertas", href: "/alertas", icon: Bell, permissions: ["INVENTARIO_VER"] },
  { label: "Reportes", href: "/reportes", icon: ChartNoAxesCombined, permissions: ["FINANZAS_VER"] },
  { label: "Usuarios", href: "/usuarios", icon: UsersRound, permissions: ["USUARIO_VER"] },
  { label: "Configuración", href: "/configuracion", icon: Settings, administratorOnly: true },
];

const routeLabels: Record<string, string> = {
  dashboard: "Inicio",
  alertas: "Alertas",
  ventas: "Ventas",
  nueva: "Nueva",
  productos: "Productos",
  inventario: "Inventario",
  reportes: "Reportes",
  usuarios: "Usuarios",
  configuracion: "Configuración",
  catalogos: "Catálogos",
  categorias: "Categorías",
  marcas: "Marcas",
  tipos: "Tipos",
  materiales: "Materiales",
  tamanos: "Tamaños",
  colores: "Colores",
  disenos: "Diseños",
  unidades: "Unidades",
  nuevo: "Nuevo",
  editar: "Editar",
  historial: "Historial",
  movimientos: "Movimientos",
  ajustes: "Ajustes",
};

function Brand() {
  return (
    <Link href="/dashboard" className="block overflow-hidden rounded-2xl bg-lf-surface/95 shadow-sm" aria-label="L&F Home Decor - Inicio">
      <Image
        src="/logo/lf-home-decor.png"
        alt="L&F Home Decor"
        width={360}
        height={180}
        priority
        className="h-[5.5rem] w-full object-cover object-center"
      />
    </Link>
  );
}

function Navigation({ pathname, permissions, profile, onNavigate }: {
  pathname: string;
  permissions: Set<string>;
  profile: string;
  onNavigate?: () => void;
}) {
  const visibleItems = navigation.filter((item) => {
    if (profile === "Administrador") return true;
    if (item.administratorOnly) return false;
    return item.permissions?.some((permission) => permissions.has(permission));
  });

  return (
    <nav aria-label="Navegación principal" className="space-y-1.5">
      {visibleItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition",
              active
                ? "bg-lf-terracotta text-white shadow-sm"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ pathname, permissions, user, onNavigate }: {
  pathname: string;
  permissions: Set<string>;
  user: ShellUser;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4"><Brand /></div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <Navigation pathname={pathname} permissions={permissions} profile={user.profile} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 p-3">
        <form action={logoutAction}>
          <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
            <LogOut size={19} strokeWidth={1.8} aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  return (
    <nav aria-label="Migas de pan" className="hidden text-sm text-lf-muted sm:block">
      <ol className="flex items-center gap-2">
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const last = index === segments.length - 1;
          const label = routeLabels[segment] ?? segment;
          return (
            <li key={href} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {last ? <span className="font-medium text-lf-navy">{label}</span> : <Link href={href} className="hover:text-lf-terracotta">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppShell({ user, permissionCodes, alertCount = 0, children }: {
  user: ShellUser;
  permissionCodes: string[];
  alertCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const permissions = new Set(permissionCodes);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-lf-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-lf-navy lg:block">
        <SidebarContent pathname={pathname} permissions={permissions} user={user} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-lf-navy/55" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[min(19rem,86vw)] bg-lf-navy shadow-[var(--lf-shadow-lg)]">
            <button className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-xl bg-lf-navy/80 text-white" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
              <X size={20} aria-hidden="true" />
            </button>
            <SidebarContent pathname={pathname} permissions={permissions} user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-lf-border/80 bg-lf-surface/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button className="grid size-10 place-items-center rounded-xl text-lf-navy hover:bg-lf-surface-muted lg:hidden" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}>
              <Menu size={22} aria-hidden="true" />
            </button>
            <Breadcrumbs pathname={pathname} />
            <div className="ml-auto flex items-center gap-2">
              <Link href="/alertas" className="relative grid size-10 place-items-center rounded-xl text-lf-muted transition hover:bg-lf-surface-muted hover:text-lf-navy" aria-label={`${alertCount} alertas de inventario`}>
                <Bell size={20} aria-hidden="true" />
                {alertCount ? <span className="absolute right-0.5 top-0.5 grid min-w-4.5 place-items-center rounded-full bg-lf-danger px-1 text-[0.65rem] font-bold leading-[1.125rem] text-white">{alertCount > 99 ? "99+" : alertCount}</span> : null}
              </Link>
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-lf-surface-muted [&::-webkit-details-marker]:hidden">
                  <span className="grid size-9 place-items-center rounded-full bg-lf-navy text-xs font-bold text-white">{user.initials}</span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-40 truncate text-sm font-semibold">{user.name}</span>
                    <span className="block text-xs text-lf-muted">{user.profile}</span>
                  </span>
                  <ChevronDown size={16} className="hidden text-lf-muted sm:block" aria-hidden="true" />
                </summary>
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border bg-lf-surface p-2 shadow-[var(--lf-shadow-md)]">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <CircleUserRound size={20} className="text-lf-terracotta" aria-hidden="true" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-lf-muted">{user.profile}</p></div>
                  </div>
                  <form action={logoutAction} className="mt-1 border-t pt-1">
                    <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-lf-danger hover:bg-[var(--lf-danger-soft)]">
                      <LogOut size={18} aria-hidden="true" /> Cerrar sesión
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </div>
        </header>
        <main className="min-w-0 px-3 py-5 min-[390px]:px-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
