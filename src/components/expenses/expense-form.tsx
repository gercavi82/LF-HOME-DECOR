"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createExpenseAction, type ExpenseActionState } from "@/app/(protected)/gastos/actions";
import { Alert, Button, Card, CardContent, Input, Spinner } from "@/src/components/ui";
import {
  EXPENSE_CATEGORIES,
  createExpenseSchema,
  type CreateExpenseInput,
  type CreateExpenseOutput,
} from "@/src/lib/validation/expenses";

const initialState: ExpenseActionState = {};

export function ExpenseForm() {
  const [state, formAction, serverPending] = useActionState(createExpenseAction, initialState);
  const [clientPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExpenseInput, unknown, CreateExpenseOutput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      fecha: today,
      categoria: "OPERATIVO",
      descripcion: "",
      monto: 0,
      beneficiario: "",
      observaciones: "",
    },
  });

  const pending = serverPending || clientPending;

  const submit = handleSubmit((values) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""));
    }
    startTransition(() => formAction(formData));
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2 sm:pt-6">
          <Input
            {...register("fecha")}
            label="Fecha"
            type="date"
            disabled={pending}
            error={errors.fecha?.message || state.fieldErrors?.fecha}
          />

          <label className="block space-y-2 text-sm font-medium">
            <span>Categoría</span>
            <select
              {...register("categoria")}
              disabled={pending}
              className="h-11 w-full rounded-xl border bg-lf-surface px-3.5 outline-none focus:border-lf-terracotta"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "FIJO" ? "Gasto Fijo (Luz, Arriendo)" :
                   cat === "MEJORAS" ? "Mejoras / Infraestructura Local" :
                   cat === "MARKETING" ? "Marketing & Publicidad" :
                   cat === "VARIABLE" ? "Gasto Variable" : "Gasto Operativo General"}
                </option>
              ))}
            </select>
            {errors.categoria?.message ? (
              <span className="block text-xs text-lf-danger">{errors.categoria.message}</span>
            ) : null}
          </label>

          <Input
            {...register("descripcion")}
            label="Descripción del gasto"
            placeholder="Ej: Pago de arriendo local matriz, compra de luces, publicidad..."
            className="sm:col-span-2"
            disabled={pending}
            error={errors.descripcion?.message || state.fieldErrors?.descripcion}
          />

          <Input
            {...register("monto")}
            label="Monto ($)"
            type="number"
            step="0.01"
            min="0.01"
            disabled={pending}
            error={errors.monto?.message || state.fieldErrors?.monto}
          />

          <Input
            {...register("beneficiario")}
            label="Beneficiario / Proveedor (opcional)"
            placeholder="Ej: Empresa Eléctrica, Propietario, Ferretería..."
            disabled={pending}
            error={errors.beneficiario?.message || state.fieldErrors?.beneficiario}
          />

          <label className="block space-y-2 text-sm font-medium sm:col-span-2">
            <span>Observaciones / Detalle adicional</span>
            <textarea
              {...register("observaciones")}
              rows={3}
              placeholder="Notas sobre el gasto o distribución..."
              disabled={pending}
              className="w-full rounded-xl border bg-lf-surface p-3.5 text-sm outline-none focus:border-lf-terracotta"
            />
          </label>
        </CardContent>
      </Card>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/gastos"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner label="Guardando..." /> : <><Save size={17} /> Guardar gasto</>}
        </Button>
      </div>
    </form>
  );
}
