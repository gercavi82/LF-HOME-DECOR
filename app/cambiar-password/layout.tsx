import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { validateCurrentSession } from "@/src/lib/auth/session";

export const metadata: Metadata = {
  title: "Cambiar contraseña",
};

export default async function ChangePasswordLayout({ children }: { children: ReactNode }) {
  const session = await validateCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return children;
}
