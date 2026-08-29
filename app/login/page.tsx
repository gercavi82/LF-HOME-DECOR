"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Alert, Button, Input, Spinner } from "@/src/components/ui";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-lf-beige px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/60 bg-lf-surface shadow-[var(--lf-shadow-lg)] lg:min-h-[42rem] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden lg:block bg-[#ede5db]">
          <Image
            src="/logo/mi-hogar-y-confort.png"
            alt="Mi Hogar y Confort - Confort y elegancia para tu hogar"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 0px"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 via-transparent to-transparent pointer-events-none" />
        </section>

        <section className="flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14 bg-white">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex justify-center lg:hidden">
              <div className="overflow-hidden rounded-2xl bg-[#ede5db] p-2 shadow-sm border border-stone-200/60">
                <Image
                  src="/logo/mi-hogar-y-confort.png"
                  alt="Mi Hogar y Confort"
                  width={260}
                  height={140}
                  priority
                  className="h-28 w-auto object-contain"
                />
              </div>
            </div>

            <header className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lf-terracotta">
                Bienvenido
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Iniciar sesión
              </h1>
              <p className="mt-3 text-sm leading-6 text-lf-muted">
                Ingresa tu cédula y contraseña para acceder al sistema.
              </p>
            </header>

            <form action={formAction} className="space-y-5" noValidate>
              <Input
                id="cedula"
                name="cedula"
                label="Usuario (cédula)"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                enterKeyHint="next"
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                placeholder="Ej. 1712345678"
                required
                disabled={isPending}
              />

              <Input
                id="password"
                name="password"
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="go"
                required
                disabled={isPending}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="grid size-8 place-items-center rounded-lg text-lf-muted transition hover:bg-lf-surface-muted hover:text-lf-navy"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                }
              />

              {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

              <Button type="submit" size="lg" disabled={isPending} className="w-full">
                {isPending ? <Spinner label="Ingresando..." /> : <><span>Ingresar</span><ArrowRight size={18} aria-hidden="true" /></>}
              </Button>
            </form>

            <Link
              href="/recuperar-password"
              className="mt-6 block text-center text-sm font-medium text-lf-muted underline decoration-lf-terracotta/50 underline-offset-4 transition hover:text-lf-terracotta"
            >
              ¿Olvidó su contraseña?
            </Link>

            <p className="mt-8 text-center text-xs leading-5 text-lf-muted">
              Acceso exclusivo para personal autorizado.
            </p>
          </div>
        </section>
      </div>
      <footer className="mt-6 text-center text-xs text-[#6B7280]">
        Desarrollado por <span className="font-semibold text-[#0B3764]">GeRCaVi</span> © 2026
      </footer>
    </main>
  );
}
