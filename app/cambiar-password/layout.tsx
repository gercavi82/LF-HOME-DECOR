import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/src/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cambiar contraseña",
};

export default async function ChangePasswordLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  return children;
}
