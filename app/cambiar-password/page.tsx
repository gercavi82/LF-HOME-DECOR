"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

const initialState: ChangePasswordState = {};

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eee5d7] px-5 py-12 text-[#17283b]">
      <section className="w-full max-w-md rounded-3xl bg-[#f9f7f2] p-7 shadow-xl shadow-[#17283b]/10 sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#c56b4d]">
          L&amp;F Home Decor
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Actualiza tu contraseña
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#657181]">
          Por seguridad, debes definir una nueva contraseña antes de continuar.
        </p>

        <form action={formAction} className="mt-8 space-y-5">
          <label className="block space-y-2 text-sm font-medium">
            <span>Nueva contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 w-full rounded-xl border border-[#d7d1c8] bg-white px-4 outline-none focus:border-[#c56b4d] focus:ring-2 focus:ring-[#c56b4d]/20"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Confirmar contraseña</span>
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 w-full rounded-xl border border-[#d7d1c8] bg-white px-4 outline-none focus:border-[#c56b4d] focus:ring-2 focus:ring-[#c56b4d]/20"
            />
          </label>

          {state.error ? (
            <p role="alert" className="rounded-lg bg-[#f9e2da] px-4 py-3 text-sm text-[#8f3f2c]">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-xl bg-[#c56b4d] px-5 font-semibold text-white transition hover:bg-[#ad573d] disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "Actualizando..." : "Guardar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}