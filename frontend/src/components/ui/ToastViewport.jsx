import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import useToastStore from '../../store/toastStore';

const typeConfig = {
  success: { icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
  error: { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)' },
  info: { icon: Info, color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.28)' },
};

export default function ToastViewport() {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 5000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
      width: 'min(360px, calc(100vw - 24px))',
    }}>
      {toasts.map((toast) => {
        const cfg = typeConfig[toast.type] || typeConfig.info;
        const Icon = cfg.icon;

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              borderRadius: 12,
              border: `1px solid ${cfg.border}`,
              background: `linear-gradient(180deg, ${cfg.bg}, rgba(24,18,16,0.94))`,
              boxShadow: '0 12px 34px rgba(0,0,0,0.36)',
              padding: '12px 12px 12px 12px',
              animation: 'toastIn 220ms cubic-bezier(0.2, 0.9, 0.2, 1)',
            }}
          >
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              flexShrink: 0,
            }}>
              <Icon size={14} color={cfg.color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f3e7e0', letterSpacing: '0.01em' }}>
                {toast.title}
              </div>
              {toast.message && (
                <div style={{ fontSize: 12, color: 'rgba(236,224,220,0.72)', marginTop: 2, lineHeight: 1.45 }}>
                  {toast.message}
                </div>
              )}
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'rgba(167,139,125,0.7)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 6,
                flexShrink: 0,
              }}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
