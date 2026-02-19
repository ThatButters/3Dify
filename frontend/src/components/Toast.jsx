import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const toast = useCallback({
    info: (msg) => addToast(msg, 'info'),
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  }, [addToast]);

  // Fix: useCallback can't return an object, use useMemo pattern via ref
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const addToast = useContext(ToastContext);
  return {
    info: (msg) => addToast(msg, 'info'),
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  };
}

const TYPE_STYLES = {
  info: 'bg-[var(--color-accent)]/90 text-white',
  success: 'bg-[var(--color-success)]/90 text-white',
  error: 'bg-[var(--color-danger)]/90 text-white',
  warning: 'bg-[var(--color-warning)]/90 text-black',
};

function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-md shadow-lg page-enter ${TYPE_STYLES[t.type] || TYPE_STYLES.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
