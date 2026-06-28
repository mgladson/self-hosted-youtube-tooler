import { createContext, useCallback, useContext, useState } from 'react';
import { X } from '@/lib/icons';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const borderColors = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  info: 'border-l-indigo-500',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg border border-border border-l-4 ${borderColors[t.type]} bg-surface px-4 py-3 shadow-lg animate-[slideIn_0.2s_ease-out]`}
          >
            <p className="text-sm text-primary">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="p-0.5 hover:bg-hover-bg rounded">
              <X size={14} className="text-muted" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
