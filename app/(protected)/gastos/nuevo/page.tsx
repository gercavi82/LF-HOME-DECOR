import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { ExpenseForm } from "@/src/components/expenses/expense-form";

export default function NewExpensePage() {
  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Gastos"
        title="Registrar nuevo gasto"
        description="Ingresa la información del gasto operativo, fijo o de mejoras del local."
        actions={
          <Link
            href="/gastos"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"
          >
            <ArrowLeft size={17} /> Volver a gastos
          </Link>
        }
      />
      <ExpenseForm />
    </ContentContainer>
  );
}
