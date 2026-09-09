"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogOut, ShieldAlert } from "lucide-react";

// Configuración de inactividad
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos (1.800.000 ms)
const WARNING_THRESHOLD_MS = 28 * 60 * 1000; // Mostrar advertencia a los 28 minutos (2 minutos restantes)
const STORAGE_KEY = "lf_last_activity_ts";

export function SessionInactivityTracker() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const isLoggingOutRef = useRef(false);
  const lastEventTimeRef = useRef<number>(Date.now());

  const performLogout = useCallback(() => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      // Limpieza exhaustiva de claves y datos en caché del navegador
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.clear();
    } catch {
      // Ignorar errores en almacenamiento local
    }

    // Redirigir al endpoint de cierre de sesión con bandera de inactividad
    window.location.href = "/api/auth/logout?reason=inactivity";
  }, []);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    lastEventTimeRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Ignorar cuota excedida o modo incógnito restringido
    }
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  useEffect(() => {
    // Inicializar marca de tiempo al montar
    const now = Date.now();
    lastEventTimeRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Ignorar
    }

    // Eventos que representan actividad del usuario
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

    // Función throttle para no saturar CPU
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (isLoggingOutRef.current) return;
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 2000); // Máximo una actualización cada 2 segundos

        const currentTime = Date.now();
        lastEventTimeRef.current = currentTime;
        try {
          localStorage.setItem(STORAGE_KEY, String(currentTime));
        } catch {}

        if (showWarning) {
          setShowWarning(false);
        }
      }
    };

    // Sincronización entre pestañas múltiples
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (Number.isFinite(remoteTime) && remoteTime > lastEventTimeRef.current) {
          lastEventTimeRef.current = remoteTime;
          if (showWarning) {
            setShowWarning(false);
          }
        }
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });
    window.addEventListener("storage", handleStorageChange);

    // Revisión periódica del temporizador de inactividad cada 2 segundos
    const checkInterval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      let effectiveLastTime = lastEventTimeRef.current;
      try {
        const stored = Number(localStorage.getItem(STORAGE_KEY));
        if (Number.isFinite(stored) && stored > effectiveLastTime) {
          effectiveLastTime = stored;
          lastEventTimeRef.current = stored;
        }
      } catch {}

      const elapsed = Date.now() - effectiveLastTime;

      // 1. Si supera los 30 minutos de inactividad: Cierre automático inmediato
      if (elapsed >= INACTIVITY_LIMIT_MS) {
        clearInterval(checkInterval);
        performLogout();
        return;
      }

      // 2. Si supera los 28 minutos: Mostrar advertencia con cuenta regresiva
      if (elapsed >= WARNING_THRESHOLD_MS) {
        const remainingMs = Math.max(0, INACTIVITY_LIMIT_MS - elapsed);
        const remainingSec = Math.ceil(remainingMs / 1000);
        setSecondsRemaining(remainingSec);
        setShowWarning(true);
      } else if (showWarning) {
        setShowWarning(false);
      }
    }, 2000);

    return () => {
      if (throttleTimeout) clearTimeout(throttleTimeout);
      clearInterval(checkInterval);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [performLogout, showWarning]);

  if (!showWarning) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <Clock size={24} className="animate-pulse" />
          </span>
          <div>
            <h3 id="inactivity-title" className="text-lg font-bold text-slate-900">
              Sesión por expirar por inactividad
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Protección de seguridad
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          Has estado inactivo por casi 30 minutos. Por políticas de seguridad, tu sesión se cerrará
          automáticamente para proteger los datos comerciales:
        </p>

        <div className="mt-4 flex items-center justify-center rounded-2xl bg-amber-50 p-4 border border-amber-200/80">
          <div className="text-center">
            <span className="font-mono text-3xl font-extrabold text-amber-900">
              {timeFormatted}
            </span>
            <span className="block text-xs font-medium text-amber-700 mt-0.5">
              segundos restantes antes del cierre
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 text-center">
          Mueve el cursor o presiona el botón inferior para mantener tu sesión activa.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={performLogout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <LogOut size={16} /> Salir ahora
          </button>
          <button
            type="button"
            onClick={resetActivity}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white shadow-md hover:bg-lf-navy-hover transition"
          >
            <ShieldAlert size={16} /> Continuar en el sistema
          </button>
        </div>
      </div>
    </div>
  );
}
