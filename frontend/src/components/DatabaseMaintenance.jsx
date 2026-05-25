import React, { useState } from 'react';
import * as api from '../lib/api';

function DatabaseMaintenance() {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const handlePurge = async (e) => {
        e.preventDefault();
        if (confirmText !== 'BORRAR TODO') return;

        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await api.resetDatabase(confirmText);

            setStatus({
                type: 'success',
                message: '¡Base de datos vaciada con éxito! Se han eliminado todos los productos, ventas y movimientos del historial, y los contadores automáticos han vuelto a cero.'
            });
            setConfirmText('');

        } catch (error) {
            console.error('Purge error:', error);
            setStatus({
                type: 'error',
                message: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <h2 style={{ color: 'var(--accent-color)', marginTop: 0, fontSize: '1.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                🔧 Mantenimiento de la Base de Datos
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Este módulo te permite preparar el sistema para ser entregado a un nuevo dueño, o restablecer el inventario en una nueva máquina. Al ejecutar esta acción, el sistema quedará totalmente limpio de datos previos para poder cargar el catálogo real.
            </p>

            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger-color)',
                borderRadius: '0.5rem',
                padding: '1rem',
                margin: '1.5rem 0',
                color: '#fca5a5'
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
                    fontSize: '0.9rem'
                }}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handlePurge} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Escribe <span style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontFamily: 'monospace', border: '1px solid var(--border-color)' }}>BORRAR TODO</span> para confirmar:
                    </label>
                    <input
                        type="text"
                        placeholder="Escribe aquí la frase de confirmación..."
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        disabled={loading}
                        style={{
                            borderColor: confirmText === 'BORRAR TODO' ? '#22c55e' : 'var(--border-color)',
                            transition: 'border-color 0.2s'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    className="danger"
                    disabled={confirmText !== 'BORRAR TODO' || loading}
                    style={{
                        padding: '0.8rem',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        cursor: confirmText === 'BORRAR TODO' && !loading ? 'pointer' : 'not-allowed',
                        opacity: confirmText === 'BORRAR TODO' && !loading ? 1 : 0.5,
                        backgroundColor: confirmText === 'BORRAR TODO' && !loading ? 'var(--danger-color)' : 'transparent',
                        color: confirmText === 'BORRAR TODO' && !loading ? 'white' : 'var(--danger-color)',
                        transition: 'all 0.3s'
                    }}
                >
                    {loading ? 'Purgando Base de Datos...' : '🗑️ Purgar Toda la Base de Datos'}
                </button>
            </form>
        </div>
    );
}

export default DatabaseMaintenance;
