import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { validateCurrentSession } from "@/src/lib/auth/session";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const session = await validateCurrentSession();

  if (session) {
    redirect("/dashboard");
  }

  return children;
}
