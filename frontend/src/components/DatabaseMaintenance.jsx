import React, { useState, useEffect } from 'react';
import * as api from '../lib/api';

// Cambia este PIN para mayor seguridad
const ADMIN_PIN = '3356';

function DatabaseMaintenance() {
    const [pin, setPin]                   = useState('');
    const [pinCorrect, setPinCorrect]     = useState(false);
    const [confirmText, setConfirmText]   = useState('');
    const [countdown, setCountdown]       = useState(5);
    const [countdownActive, setCountdownActive] = useState(false);
    const [countdownDone, setCountdownDone]     = useState(false);
    const [loading, setLoading]           = useState(false);
    const [status, setStatus]             = useState({ type: '', message: '' });

    const bothReady = pinCorrect && confirmText === 'BORRAR TODO';

    // Inicia o resetea el countdown cuando cambian las condiciones
    useEffect(() => {
        if (bothReady && !countdownActive && !countdownDone) {
            setCountdown(5);
            setCountdownActive(true);
        }
        if (!bothReady && (countdownActive || countdownDone)) {
            setCountdownActive(false);
            setCountdownDone(false);
            setCountdown(5);
        }
    }, [bothReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // Tick del countdown
    useEffect(() => {
        if (!countdownActive || countdownDone) return;
        if (countdown <= 0) {
            setCountdownActive(false);
            setCountdownDone(true);
            return;
        }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown, countdownActive, countdownDone]);

    const handlePinChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setPin(val);
        const correct = val === ADMIN_PIN;
        setPinCorrect(correct);
        if (!correct) {
            setConfirmText('');
            setCountdown(5);
            setCountdownActive(false);
            setCountdownDone(false);
        }
    };

    const handleConfirmChange = (e) => {
        const val = e.target.value;
        setConfirmText(val);
        if (val !== 'BORRAR TODO') {
            setCountdown(5);
            setCountdownActive(false);
            setCountdownDone(false);
        }
    };

    const handlePurge = async (e) => {
        e.preventDefault();
        if (!pinCorrect || confirmText !== 'BORRAR TODO' || !countdownDone || loading) return;

        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await api.resetDatabase(confirmText);
            setStatus({
                type: 'success',
                message: '¡Base de datos vaciada con éxito! Se han eliminado todos los productos, ventas y movimientos del historial, y los contadores automáticos han vuelto a cero.',
            });
            setPin('');
            setPinCorrect(false);
            setConfirmText('');
            setCountdown(5);
            setCountdownActive(false);
            setCountdownDone(false);
        } catch (error) {
            console.error('Purge error:', error);
            setStatus({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const btnEnabled = pinCorrect && confirmText === 'BORRAR TODO' && countdownDone && !loading;

    return (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <h2 style={{ color: 'var(--accent-color)', marginTop: 0, fontSize: '1.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                🔧 Mantenimiento de la Base de Datos
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Este módulo permite preparar el sistema para ser entregado a un nuevo dueño, o restablecer el inventario en una nueva máquina. Al ejecutar esta acción, el sistema quedará totalmente limpio de datos previos.
            </p>

            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger-color)',
                borderRadius: '0.5rem',
                padding: '1rem',
                margin: '1.5rem 0',
                color: '#fca5a5',
            }}>
                <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 'bold' }}>
                    ⚠️ ADVERTENCIA CRÍTICA
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán de forma definitiva:
                </p>
                <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.875rem', lineHeight: '1.5' }}>
                    <li>Todos los productos registrados en el inventario.</li>
                    <li>Todas las existencias (stock) actuales.</li>
                    <li>Todo el historial de ventas registradas.</li>
                    <li>Los contadores de IDs se restablecerán a 1.</li>
                </ul>
            </div>

            {status.message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    background: status.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${status.type === 'success' ? '#22c55e' : 'var(--danger-color)'}`,
                    color: status.type === 'success' ? '#86efac' : '#fca5a5',
                    fontSize: '0.9rem',
                }}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handlePurge} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* ── Paso 1: PIN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Paso 1 — Ingresa el PIN de administrador:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                            type="password"
                            inputMode="numeric"
                            placeholder="PIN numérico"
                            value={pin}
                            onChange={handlePinChange}
                            disabled={loading}
                            style={{
                                width: '140px',
                                borderColor: pin.length > 0 ? (pinCorrect ? '#22c55e' : '#ef4444') : 'var(--border-color)',
                                transition: 'border-color 0.2s',
                                fontFamily: 'monospace',
                                letterSpacing: '0.25em',
                            }}
                        />
                        {pin.length > 0 && (
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: pinCorrect ? '#22c55e' : '#ef4444' }}>
                                {pinCorrect ? '✓ Correcto' : '✗ Incorrecto'}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Paso 2: frase de confirmación (solo visible si PIN OK) ── */}
                {pinCorrect && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Paso 2 — Escribe{' '}
                            <span style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>
                                BORRAR TODO
                            </span>{' '}
                            para confirmar:
                        </label>
                        <input
                            type="text"
                            placeholder="Escribe aquí la frase de confirmación..."
                            value={confirmText}
                            onChange={handleConfirmChange}
                            disabled={loading}
                            style={{
                                borderColor: confirmText === 'BORRAR TODO' ? '#22c55e' : 'var(--border-color)',
                                transition: 'border-color 0.2s',
                            }}
                        />
                    </div>
                )}

                {/* ── Countdown ── */}
                {bothReady && !countdownDone && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '0.5rem', padding: '0.75rem 1rem',
                    }}>
                        <span style={{
                            fontSize: '2rem', fontWeight: 900, color: '#ef4444',
                            minWidth: '2rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                        }}>
                            {countdown}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                            El botón se habilitará en {countdown} segundo{countdown !== 1 ? 's' : ''}. Si estás seguro, espera.
                        </span>
                    </div>
                )}

                {/* ── Botón ── */}
                <button
                    type="submit"
                    className="danger"
                    disabled={!btnEnabled}
                    style={{
                        padding: '0.8rem',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        cursor: btnEnabled ? 'pointer' : 'not-allowed',
                        opacity: btnEnabled ? 1 : 0.45,
                        backgroundColor: btnEnabled ? 'var(--danger-color)' : 'transparent',
                        color: btnEnabled ? 'white' : 'var(--danger-color)',
                        transition: 'all 0.3s',
                    }}
                >
                    {loading ? 'Purgando Base de Datos...' : '🗑️ Purgar Toda la Base de Datos'}
                </button>
            </form>
        </div>
    );
}

export default DatabaseMaintenance;
