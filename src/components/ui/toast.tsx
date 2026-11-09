"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useState } from "react";

type Tone = "default" | "error";
/** A single follow-up the reader can take from the toast, such as Undo. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Toast { id: number; message: string; tone: Tone; action?: ToastAction }

const ToastCtx = createContext<(message: string, tone?: Tone, action?: ToastAction) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Tone = "default", action?: ToastAction) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      // Long enough to reach an Undo button without hurrying.
      setTimeout(() => dismiss(id), action ? 8000 : 3600);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-8">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: -0.5 }}
              exit={{ opacity: 0, y: 8 }}
              className={`pointer-events-auto flex max-w-sm items-center gap-4 border px-4 py-2.5 text-sm shadow-[var(--shadow-lift)] ${
                t.tone === "error" ? "border-burgundy bg-burgundy text-paper" : "border-ink bg-ink text-paper"
              }`}
              role={t.tone === "error" ? "alert" : "status"}
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(t.id);
                    t.action!.onClick();
                  }}
                  className="-my-1 shrink-0 border-b border-butter py-1 font-medium text-butter hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-butter"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
