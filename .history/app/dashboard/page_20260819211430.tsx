import { redirect } from "next/navigation";

import { createClient } from "@/src/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#eee5d7] px-6 py-16 text-[#17283b]">
      <div className="mx-auto max-w-5xl rounded-3xl bg-[#f9f7f2] p-8 shadow-xl shadow-[#17283b]/10">
        <p className="text-sm uppercase tracking-[0.2em] text-[#c56b4d]">
          L&amp;F Home Decor
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Dashboard</h1>
        <p className="mt-3 text-[#657181]">Sesión autenticada correctamente.</p>
      </div>
    </main>
  );
}