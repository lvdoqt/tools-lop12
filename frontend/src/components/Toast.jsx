import { useState, useEffect, useRef } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  return { toasts, addToast };
}

export function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast"
          style={{
            borderColor:
              toast.type === 'success' ? 'rgba(52, 211, 153, 0.3)' :
              toast.type === 'warning' ? 'rgba(251, 146, 60, 0.3)' :
              toast.type === 'error' ? 'rgba(244, 63, 94, 0.3)' :
              'rgba(79, 140, 255, 0.3)',
          }}
        >
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
