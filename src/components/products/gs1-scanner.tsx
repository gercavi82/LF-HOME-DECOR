"use client";

import { Camera, CameraOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isValidGs1, normalizeGs1 } from "@/src/lib/gs1";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: ImageBitmapSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

export function Gs1Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) { setError("Este navegador no admite escaneo. Puede ingresar el código manualmente."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ["ean_8", "ean_13", "upc_a", "itf"] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = normalizeGs1(codes[0]?.rawValue ?? "");
            if (value && isValidGs1(value)) { onDetected(value); setOpen(false); return; }
          } catch { /* continúa intentando mientras la cámara está activa */ }
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch { setError("No fue posible acceder a la cámara. Revise los permisos del navegador."); }
    }
    void start();
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((track) => track.stop()); };
  }, [open, onDetected]);

  return <>
    <button type="button" onClick={() => { setError(undefined); setOpen(true); }} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-lf-surface-muted"><Camera size={17} /> Escanear</button>
    {open ? <div className="fixed inset-0 z-[70] grid place-items-center bg-lf-navy/70 p-4"><div className="w-full max-w-lg rounded-2xl bg-lf-surface p-4 shadow-[var(--lf-shadow-lg)]"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Escanear código GS1</h2><p className="text-sm text-lf-muted">Centre el código de barras frente a la cámara.</p></div><button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-lf-surface-muted" aria-label="Cerrar escáner"><X size={19} /></button></div>{error ? <div className="grid min-h-52 place-items-center rounded-xl bg-lf-surface-muted p-5 text-center"><div><CameraOff className="mx-auto text-lf-muted" /><p className="mt-3 text-sm">{error}</p></div></div> : <video ref={videoRef} playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />}<button type="button" onClick={() => setOpen(false)} className="mt-3 h-10 w-full rounded-xl border text-sm font-semibold">Cancelar</button></div></div> : null}
  </>;
}
