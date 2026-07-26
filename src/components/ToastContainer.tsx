import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import type { Toast } from '../stores/uiStore';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  const undoToasts = toasts.filter(t => !!t.action);
  const regularToasts = toasts.filter(t => !t.action);

  return (
    <>
      {/* Regular toasts — bottom-right */}
      {regularToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {regularToasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </div>
      )}

      {/* Undo toasts — bottom-center */}
      {undoToasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
          {undoToasts.map(toast => (
            <div
              key={toast.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border bg-[var(--color-black)] text-white"
              style={{ minWidth: 240, animation: 'toast-slide-up 0.3s ease both' }}
            >
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
                className="text-sm font-semibold px-3 py-1 rounded-md"
                style={{ background: 'var(--color-accent)', color: 'white' }}
              >
                {toast.action!.label}
              </button>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-white/40 hover:text-white/70 ml-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`flex items-start gap-3 min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-lg border ${getToastStyles(toast.type)}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getToastIcon(toast.type)}
      </div>
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-black/40 hover:text-black/70"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function getToastStyles(type: 'success' | 'error' | 'warning' | 'info'): string {
  switch (type) {
    case 'success':
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'error':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'warning':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-800';
  }
}

function getToastIcon(type: 'success' | 'error' | 'warning' | 'info') {
  const size = 18;
  switch (type) {
    case 'success':
      return <CheckCircle size={size} className="text-emerald-400" />;
    case 'error':
      return <AlertCircle size={size} className="text-red-400" />;
    case 'warning':
      return <AlertTriangle size={size} className="text-amber-400" />;
    case 'info':
      return <Info size={size} className="text-blue-400" />;
  }
}
