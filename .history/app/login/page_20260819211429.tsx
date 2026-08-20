"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[#eee5d7] px-5 py-8 text-[#17283b] sm:px-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl overflow-hidden rounded-[2rem] bg-[#f9f7f2] shadow-2xl shadow-[#17283b]/10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#17283b] p-12 text-[#f9f7f2] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3rem] border-[#c56b4d]/80" />
          <div className="relative">
            <p className="text-sm uppercase tracking-[0.3em] text-[#e4b79f]">
              L&amp;F Home Decor
            </p>
            <h1 className="mt-20 max-w-sm text-5xl font-semibold leading-[1.05]">
              Espacios que cuentan tu historia.
            </h1>
          </div>
          <p className="relative max-w-xs text-sm leading-6 text-[#d6dce1]">
            Gestiona tu operación con claridad, cuidado y el estilo que define
            a L&amp;F.
          </p>
        </section>

        <section className="flex items-center px-6 py-12 sm:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-12 lg:hidden">
              <p className="text-sm uppercase tracking-[0.25em] text-[#c56b4d]">
                L&amp;F Home Decor
              </p>
            </div>
            <div className="mb-9 space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#c56b4d]">
                Bienvenido
              </p>
              <h2 className="text-4xl font-semibold tracking-tight">
                Iniciar sesión
              </h2>
              <p className="text-[#657181]">
                Ingresa con tu número de cédula.
              </p>
            </div>

            <form action={formAction} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                <span>Usuario (cédula)</span>
                <input
                  name="cedula"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  maxLength={10}
                  required
                  className="h-12 w-full rounded-xl border border-[#d7d1c8] bg-white px-4 outline-none transition focus:border-[#c56b4d] focus:ring-2 focus:ring-[#c56b4d]/20"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                <span>Contraseña</span>
                <span className="flex h-12 rounded-xl border border-[#d7d1c8] bg-white focus-within:border-[#c56b4d] focus-within:ring-2 focus-within:ring-[#c56b4d]/20">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="min-w-0 flex-1 rounded-xl bg-transparent px-4 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="px-4 text-xs font-semibold text-[#657181] hover:text-[#17283b]"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </span>
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
                {isPending ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <Link
              href="/recuperar-password"
              className="mt-6 block text-center text-sm font-medium text-[#657181] underline decoration-[#c56b4d]/50 underline-offset-4 hover:text-[#c56b4d]"
            >
              ¿Olvidó su contraseña?
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}