import { useEffect, useMemo, useState } from 'react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
  zIndex = 2200,
}) {
  if (!open) return null;

  return (
    <div className="ui-overlay" style={{ zIndex, padding: 16 }} onClick={onCancel}>
      <div
        className="ui-subwindow card"
        style={{ width: 'min(460px, 100%)', padding: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{title}</h3>
        {message && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={danger ? '' : 'btn-primary'}
            style={danger ? {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.14)',
              color: '#f87171',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.65 : 1,
            } : undefined}
          >
            {busy ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptDialog({
  open,
  title,
  message,
  label = 'Value',
  defaultValue = '',
  placeholder = '',
  type = 'text',
  minLength = 0,
  confirmText = 'Save',
  cancelText = 'Cancel',
  onSubmit,
  onCancel,
  busy = false,
  error = '',
  onValueChange,
  zIndex = 2200,
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue || '');
  }, [open, defaultValue]);

  const localValidation = useMemo(() => {
    if (!open) return '';
    if (minLength > 0 && (value || '').length < minLength) {
      return `Minimum ${minLength} characters required.`;
    }
    return '';
  }, [open, value, minLength]);

  if (!open) return null;

  return (
    <div className="ui-overlay" style={{ zIndex, padding: 16 }} onClick={onCancel}>
      <div
        className="ui-subwindow card"
        style={{ width: 'min(500px, 100%)', padding: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{title}</h3>
        {message && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {message}
          </p>
        )}

        <div style={{ marginTop: 14 }}>
          <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
            {label}
          </label>
          <input
            autoFocus
            type={type}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (onValueChange) onValueChange(e.target.value);
            }}
            className="input"
            placeholder={placeholder}
          />
          {(error || localValidation) && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>
              {error || localValidation}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSubmit(value)}
            disabled={busy || !!localValidation}
          >
            {busy ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

