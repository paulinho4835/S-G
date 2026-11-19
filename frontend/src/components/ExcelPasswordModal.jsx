import React, { useRef, useState } from 'react';
import { Download, LockKeyhole, X } from 'lucide-react';

export default function ExcelPasswordModal({ onConfirm, onClose }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const passwordRef = useRef(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!password || loading) return;

        let passwordToVerify = password;
        setPassword('');
        setError('');
        setLoading(true);
        try {
            await onConfirm(passwordToVerify);
            onClose();
        } catch (reason) {
            setError(reason?.message || 'No se pudo verificar la contraseña. Inténtalo de nuevo.');
            passwordRef.current?.focus();
        } finally {
            passwordToVerify = '';
            setLoading(false);
        }
    };

    return (
        <div
            style={styles.overlay}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !loading) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="excel-password-title"
                aria-describedby="excel-password-description"
                style={styles.panel}
            >
                <header style={styles.header}>
                    <span style={styles.icon}><LockKeyhole size={19} /></span>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Cerrar" style={styles.close}>
                        <X size={18} />
                    </button>
                </header>

                <h2 id="excel-password-title" style={styles.title}>Confirma tu contraseña</h2>
                <p id="excel-password-description" style={styles.description}>
                    Ingresa la contraseña de tu cuenta para descargar el Excel de productos.
                </p>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="excel-export-password" style={styles.label}>Contraseña de la cuenta</label>
                    <input
                        ref={passwordRef}
                        id="excel-export-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={loading}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'excel-password-error' : 'excel-password-description'}
                        style={error ? { ...styles.input, ...styles.inputError } : styles.input}
                    />
                    {error && <p id="excel-password-error" role="alert" style={styles.error}>{error}</p>}

                    <div style={styles.actions}>
                        <button type="button" onClick={onClose} disabled={loading} style={styles.cancel}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={!password || loading} className="primary" style={styles.submit}>
                            <Download size={16} />
                            {loading ? 'Verificando…' : 'Verificar y descargar'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(2, 8, 16, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
    },
    panel: {
        width: '100%',
        maxWidth: '420px',
        padding: '1.5rem',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        background: 'var(--card-bg, #101a28)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    icon: {
        display: 'grid',
        placeItems: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        background: 'var(--accent-dim)',
        color: 'var(--accent-color)',
    },
    close: {
        display: 'grid',
        placeItems: 'center',
        width: '36px',
        height: '36px',
        border: '1px solid var(--border-color)',
        borderRadius: '9px',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
    },
    title: { margin: '1rem 0 0.4rem', color: 'var(--text-primary)', fontSize: '1.2rem' },
    description: { margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 },
    label: { display: 'block', marginBottom: '0.45rem', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 },
    input: { width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '9px', background: 'var(--surface-2)', color: 'var(--text-primary)' },
    inputError: { borderColor: 'var(--danger-color, #ef4444)' },
    error: { margin: '0.55rem 0 0', color: 'var(--danger-color, #fca5a5)', fontSize: '0.8rem' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' },
    cancel: { padding: '0.65rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' },
    submit: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', minHeight: '42px', padding: '0.65rem 0.9rem' },
};
