"use client";

import { FileWarning, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function PdfPreview({ url, page, zoom }: { url: string; page: number; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let documentTask: { destroy: () => Promise<void> } | null = null;
    let renderTask: { cancel: () => void } | null = null;

    async function render() {
      setLoading(true);
      setError(false);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loaded = pdfjs.getDocument({ url, isEvalSupported: false });
        documentTask = loaded;
        const pdf = await loaded.promise;
        if (cancelled) return;
        const target = Math.min(Math.max(page, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(target);
        if (cancelled) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const available = Math.min(900, Math.max(320, window.innerWidth - 80));
        const fit = available / baseViewport.width;
        const scale = Math.min(2.4, Math.max(0.5, fit * zoom));
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        const task = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        renderTask = task;
        await task.promise;
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof Error && cause.name === "RenderingCancelledException") return;
        setError(true);
        setLoading(false);
      }
    }

    void render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void documentTask?.destroy();
    };
  }, [url, page, zoom]);

  if (error) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-line bg-paper-deep/30 p-6 text-center">
        <FileWarning className="size-6 text-accent" />
        <p className="text-sm font-medium text-ink">The inline PDF preview could not render.</p>
        <p className="max-w-xs text-xs leading-relaxed text-ink-muted">
          The extracted text is still available. You can open the original file in a new tab.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noreferrer noopener">
            Open original PDF
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[320px] items-start justify-center overflow-auto rounded-xl bg-paper-deep/40 p-4">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-paper/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-line bg-paper-soft px-3.5 py-2 text-xs text-ink-soft">
            <Loader2 className="size-3.5 animate-spin text-accent" /> Rendering page {page}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full rounded-sm bg-white shadow-card" />
    </div>
  );
}
