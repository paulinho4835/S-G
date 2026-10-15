import React, { useEffect, useState } from 'react';
import * as api from '../lib/api';
import BankQrSettings from './BankQrSettings';

const CONFIRMATION = 'BORRAR TODO';

export default function DatabaseMaintenance() {
    const [confirmText, setConfirmText] = useState('');
    const [countdown, setCountdown] = useState(5);
    const [countdownDone, setCountdownDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const ready = confirmText === CONFIRMATION;

    useEffect(() => {
        if (!ready) {
            setCountdown(5);
            setCountdownDone(false);
            return undefined;
        }
        if (countdown <= 0) {
            setCountdownDone(true);
            return undefined;
        }
        const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [ready, countdown]);

    const handlePurge = async (event) => {
        event.preventDefault();
        if (!ready || !countdownDone || loading) return;

        setLoading(true);
        setStatus({ type: '', message: '' });
        try {
            await api.resetDatabase(CONFIRMATION);
            setStatus({
                type: 'success',
                message: 'La base de datos fue vaciada correctamente. El servidor registró la operación en la auditoría.',
            });
            setConfirmText('');
            setCountdown(5);
            setCountdownDone(false);
        } catch (error) {
            console.error('Purge error:', error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <BankQrSettings />
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '2rem auto' }}>
                <h2 style={{ color: 'var(--accent-color)', marginTop: 0, fontSize: '1.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    Mantenimiento de la Base de Datos
                </h2>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    Esta operación es irreversible y elimina productos, ventas, movimientos, pedidos mayoristas y cotizaciones.
                    La autorización real se valida en Supabase con el rol administrativo del usuario.
                </p>

                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--danger-color)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    margin: '1.5rem 0',
                    color: '#fca5a5',
                }}>
                    <strong>Advertencia:</strong> esta acción no se puede deshacer. Verifica que exista un respaldo antes de continuar.
                </div>

                {status.message && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginBottom: '1.5rem',
                        background: status.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${status.type === 'success' ? '#22c55e' : 'var(--danger-color)'}`,
                        color: status.type === 'success' ? '#86efac' : '#fca5a5',
                    }}>
                        {status.message}
                    </div>
                )}

                <form onSubmit={handlePurge} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Escribe <code>{CONFIRMATION}</code> para confirmar:
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={event => setConfirmText(event.target.value)}
                        placeholder={CONFIRMATION}
                        disabled={loading}
                    />

                    {ready && !countdownDone && (
                        <div style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            El botón se habilitará en {countdown} segundo{countdown === 1 ? '' : 's'}.
                        </div>
                    )}

                    <button
                        type="submit"
                        className="danger"
                        disabled={!ready || !countdownDone || loading}
                        style={{ padding: '0.8rem', fontWeight: 'bold', opacity: ready && countdownDone && !loading ? 1 : 0.45 }}
                    >
                        {loading ? 'Purgando base de datos...' : 'Purgar toda la base de datos'}
                    </button>
                </form>
            </div>
        </>
    );
}
