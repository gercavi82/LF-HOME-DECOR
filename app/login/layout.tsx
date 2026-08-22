import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/src/lib/supabase/server";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  return children;
}
