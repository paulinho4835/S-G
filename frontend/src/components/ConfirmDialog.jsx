import React from 'react';

/**
 * Modal de confirmación personalizado — reemplaza window.confirm().
 * No bloquea el foco del cursor en Electron/Windows.
 *
 * Props:
 *   message   - string  → Pregunta a mostrar
 *   onConfirm - fn      → Llamada al confirmar
 *   onCancel  - fn      → Llamada al cancelar
 *   danger    - bool    → Si true, botón en rojo (default true)
 */
export default function ConfirmDialog({ message, onConfirm, onCancel, danger = true }) {
    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }}>
            <div style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}>
                <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>⚠️</div>
                <p style={{ color: '#f8fafc', fontSize: '0.97rem', lineHeight: '1.6', marginBottom: '1.75rem', margin: '0 0 1.75rem' }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'transparent',
                            border: '1px solid #475569',
                            color: '#94a3b8',
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            background: danger ? '#ef4444' : '#38bdf8',
                            border: 'none',
                            color: 'white',
                            padding: '0.65rem 1.75rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                        }}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}
