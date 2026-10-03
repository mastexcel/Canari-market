"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modale accessible basée sur <dialog> natif (piège du focus, Échap, inert
 * du reste de la page gérés par le navigateur). Sur mobile : feuille du bas.
 */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 backdrop:bg-anthracite-950/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="p-5 pb-[calc(1.25rem+var(--safe-bottom))]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-gris-100 text-xl" aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
