import { requireAuthContext } from "@/src/services/auth/authorization";

export default async function DashboardPage() {
  const context = await requireAuthContext();

  return (
    <main className="min-h-screen bg-[#eee5d7] px-6 py-16 text-[#17283b]">
      <div className="mx-auto max-w-5xl rounded-3xl bg-[#f9f7f2] p-8 shadow-xl shadow-[#17283b]/10">
        <p className="text-sm uppercase tracking-[0.2em] text-[#c56b4d]">
          L&amp;F Home Decor
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Dashboard</h1>
        <p className="mt-3 text-[#657181]">
          Sesión autenticada como {context.perfil}.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#d7d1c8] bg-white p-5">
            <p className="text-sm text-[#657181]">Usuario</p>
            <p className="mt-1 font-semibold">
              {context.nombres} {context.apellidos}
            </p>
          </div>
          <div className="rounded-2xl border border-[#d7d1c8] bg-white p-5">
            <p className="text-sm text-[#657181]">Permisos asignados</p>
            <p className="mt-1 font-semibold">{context.permisos.length}</p>
          </div>
        </div>
      </div>
    </main>
  );
}