"use client";

import { KeyRound, Lock, Power, Unlock } from "lucide-react";

import { changeUserStatusAction, resetUserPasswordAction } from "@/app/(protected)/usuarios/actions";
import { Button } from "@/src/components/ui";

export function UserAdminActions({ id, active, blocked }: {
  id: number;
  active: boolean;
  blocked: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={changeUserStatusAction} onSubmit={(event) => { if (!confirm(`¿Confirma que desea ${active ? "desactivar" : "activar"} este usuario?`)) event.preventDefault(); }}>
        <input type="hidden" name="id_usuario" value={id} />
        <input type="hidden" name="operation" value={active ? "deactivate" : "activate"} />
        <Button type="submit" variant="outline" className="w-full">
          <Power size={17} aria-hidden="true" /> {active ? "Desactivar" : "Activar"}
        </Button>
      </form>
      <form action={changeUserStatusAction} onSubmit={(event) => { if (!confirm(`¿Confirma que desea ${blocked ? "desbloquear" : "bloquear"} este usuario?`)) event.preventDefault(); }}>
        <input type="hidden" name="id_usuario" value={id} />
        <input type="hidden" name="operation" value={blocked ? "unblock" : "block"} />
        <Button type="submit" variant={blocked ? "outline" : "danger"} className="w-full">
          {blocked ? <Unlock size={17} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />} {blocked ? "Desbloquear" : "Bloquear"}
        </Button>
      </form>
      <form action={resetUserPasswordAction} className="sm:col-span-2" onSubmit={(event) => { if (!confirm("¿Restablecer la contraseña temporal a la cédula del usuario?")) event.preventDefault(); }}>
        <input type="hidden" name="id_usuario" value={id} />
        <Button type="submit" variant="secondary" className="w-full">
          <KeyRound size={17} aria-hidden="true" /> Restablecer contraseña temporal
        </Button>
      </form>
    </div>
  );
}
