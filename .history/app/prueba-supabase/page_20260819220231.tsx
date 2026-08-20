import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupabaseTestPage() {
  const supabase = await createClient();
  const { data: categorias, error } = await supabase
    .from("categorias")
    .select("*")
    .limit(10);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-950 sm:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
            Fase 8
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Prueba de conexión con Supabase
          </h1>
          <p className="text-zinc-600">
            Consulta de lectura a la tabla pública categorias.
          </p>
        </header>

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
            <h2 className="font-semibold">La consulta no pudo completarse</h2>
            <p className="mt-2 text-sm">
              Verifica que la tabla categorias exista en Supabase y que sus
              políticas RLS permitan esta lectura.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="font-semibold">Categorías recibidas</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {categorias?.length ?? 0} registro(s) encontrado(s).
              </p>
            </div>
            <pre className="overflow-x-auto p-5 text-sm text-zinc-700">
              {JSON.stringify(categorias ?? [], null, 2)}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}