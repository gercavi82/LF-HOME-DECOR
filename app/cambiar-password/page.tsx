"use client";

import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, Button, Card, CardContent, Input, Spinner } from "@/src/components/ui";

import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  const visibilityButton = (
    <button
      type="button"
      onClick={() => setShowPassword((visible) => !visible)}
      aria-label={showPassword ? "Ocultar contraseñas" : "Mostrar contraseñas"}
      aria-pressed={showPassword}
      className="grid size-8 place-items-center rounded-lg text-lf-muted transition hover:bg-lf-surface-muted hover:text-lf-navy"
    >
      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  );

  return (
    <main className="grid min-h-screen place-items-center bg-lf-beige px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl">
        <div className="mb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-lf-terracotta">L&amp;F Home Decor</p>
        </div>

        <Card className="grid overflow-hidden rounded-[2rem] border-white/70 shadow-[var(--lf-shadow-lg)] lg:grid-cols-[0.82fr_1.18fr]">
          <section className="hidden bg-lf-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="grid size-14 place-items-center rounded-2xl bg-lf-terracotta">
              <ShieldCheck size={28} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold leading-tight">Protege tu acceso</h2>
              <p className="mt-4 text-sm leading-6 text-white/70">
                La contraseña temporal debe reemplazarse antes de utilizar los módulos del sistema.
              </p>
            </div>
          </section>

          <CardContent className="p-6 pt-6 sm:p-10 lg:p-12">
            <header>
              <div className="grid size-12 place-items-center rounded-2xl bg-[var(--lf-info-soft)] text-lf-info lg:hidden">
                <KeyRound size={24} aria-hidden="true" />
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">Actualiza tu contraseña</h1>
              <p className="mt-3 text-sm leading-6 text-lf-muted">
                Define una contraseña personal antes de continuar al sistema.
              </p>
            </header>

            <div className="mt-6 rounded-2xl bg-lf-surface-muted p-4">
              <p className="text-sm font-semibold">La nueva contraseña debe:</p>
              <ul className="mt-3 space-y-2 text-sm text-lf-muted">
                <li className="flex items-center gap-2"><Check size={16} className="text-lf-success" aria-hidden="true" /> Tener al menos 8 caracteres.</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-lf-success" aria-hidden="true" /> Ser diferente de tu cédula.</li>
                <li className="flex items-center gap-2"><Check size={16} className="text-lf-success" aria-hidden="true" /> Coincidir en ambos campos.</li>
              </ul>
            </div>

            <form action={formAction} className="mt-7 space-y-5" noValidate>
              <Input
                id="new-password"
                name="password"
                label="Nueva contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isPending}
                endAdornment={visibilityButton}
              />
              <Input
                id="password-confirmation"
                name="confirmation"
                label="Confirmar contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isPending}
                endAdornment={visibilityButton}
              />

              {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

              <Button type="submit" size="lg" disabled={isPending} className="w-full">
                {isPending ? <Spinner label="Actualizando..." /> : "Guardar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
