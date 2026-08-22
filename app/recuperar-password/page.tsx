"use client";

import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { Alert, Button, Card, CardContent, Input, Spinner } from "@/src/components/ui";

import { requestPasswordRecovery, type RecoveryState } from "./actions";

const initialState: RecoveryState = {};

function RecoveryForm() {
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(requestPasswordRecovery, initialState);
  const invalidLink = searchParams.get("error") === "enlace-invalido";

  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/70 shadow-[var(--lf-shadow-lg)]">
      <div className="h-2 bg-lf-terracotta" />
      <CardContent className="p-6 pt-7 sm:p-10 sm:pt-9">
        <div className="grid size-12 place-items-center rounded-2xl bg-[var(--lf-info-soft)] text-lf-info">
          {state.success ? <MailCheck size={24} aria-hidden="true" /> : <KeyRound size={24} aria-hidden="true" />}
        </div>

        <header className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lf-terracotta">L&amp;F Home Decor</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Recuperar contraseña</h1>
          <p className="mt-3 text-sm leading-6 text-lf-muted">
            Ingresa tu cédula y enviaremos las instrucciones al correo asociado con tu cuenta.
          </p>
        </header>

        {invalidLink ? (
          <Alert variant="warning" className="mt-6" title="Enlace inválido o vencido">
            Solicita un nuevo correo de recuperación para continuar.
          </Alert>
        ) : null}

        {state.success ? (
          <Alert variant="success" className="mt-6" title="Solicitud recibida">
            {state.success}
          </Alert>
        ) : (
          <form action={formAction} className="mt-7 space-y-5" noValidate>
            <Input
              id="recovery-cedula"
              name="cedula"
              label="Cédula"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              enterKeyHint="send"
              minLength={10}
              maxLength={10}
              pattern="[0-9]{10}"
              placeholder="Ej. 1712345678"
              required
              disabled={isPending}
            />

            {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

            <Button type="submit" size="lg" disabled={isPending} className="w-full">
              {isPending ? <Spinner label="Enviando..." /> : "Enviar instrucciones"}
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-lf-muted transition hover:text-lf-terracotta">
          <ArrowLeft size={17} aria-hidden="true" /> Volver al inicio de sesión
        </Link>
      </CardContent>
    </Card>
  );
}

export default function RecoverPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-lf-beige px-4 py-8 sm:px-6">
      <div className="w-full max-w-lg">
        <Suspense fallback={<Card className="h-[30rem] animate-pulse rounded-[2rem] bg-lf-surface" />}>
          <RecoveryForm />
        </Suspense>
      </div>
    </main>
  );
}
