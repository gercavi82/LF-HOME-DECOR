export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eee5d7] px-6 text-[#17283b]">
      <section className="w-full max-w-lg rounded-3xl bg-[#f9f7f2] p-10 text-center shadow-xl shadow-[#17283b]/10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#c56b4d]">
          Acceso restringido
        </p>
        <h1 className="mt-4 text-3xl font-semibold">No tienes permiso</h1>
        <p className="mt-3 text-[#657181]">
          Tu perfil no tiene autorización para realizar esta operación.
        </p>
      </section>
    </main>
  );
}