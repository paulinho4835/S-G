import React, { useState, useEffect } from 'react';

const TYPE_CONFIG = {
    VENTA: { label: 'Venta', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔴' },
    DEVOLUCION: { label: 'Devolución', color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: '🔄' },
    INGRESO_EXCEL: { label: 'Carga Excel', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', icon: '📥' },
    REGISTRO_NUEVO: { label: 'Registro Manual', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '✏️' },
    AJUSTE_ENTRADA: { label: 'Ajuste Entrada', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '🟢' },
    AJUSTE_SALIDA: { label: 'Ajuste Salida', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔻' },
    INGRESO_AJUSTE: { label: 'Ajuste Entrada', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '🟢' },
    EGRESO_AJUSTE: { label: 'Ajuste Salida', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔻' },
    STOCK_INICIAL: { label: 'Stock Inicial', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '🏁' },
};

// Which types are "commercial" (sales tab) vs "manual" (records tab)
const COMMERCIAL_TYPES = new Set(['VENTA', 'DEVOLUCION']);
const MANUAL_TYPES = new Set(['INGRESO_EXCEL', 'REGISTRO_NUEVO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'INGRESO_AJUSTE', 'EGRESO_AJUSTE', 'STOCK_INICIAL']);

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('es-EC', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

function buildPrintHtml(part, movements, tabLabel) {
    const rows = movements.map((m, i) => {
        const c = TYPE_CONFIG[m.type] || { label: m.type, icon: '📋' };
        const isNeg = m.quantity < 0;
        const qty = Math.abs(m.quantity);
        return `
            <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
                <td>${formatDate(m.created_at)}</td>
                <td>${c.icon} ${c.label}</td>
                <td style="text-align:right;color:${isNeg ? '#dc2626' : '#16a34a'};font-weight:700">
                    ${isNeg ? '-' : '+'}${qty}
                </td>
                <td style="text-align:right">${m.price > 0 ? `Bs. ${m.price.toFixed(2)}` : '—'}</td>
                <td>${m.concept || '—'}</td>
                <td style="text-align:right;font-weight:700;color:${m.balance <= 0 ? '#dc2626' : m.balance <= 5 ? '#d97706' : '#2563eb'}">
                    ${m.balance}
                </td>
            </tr>`;
    }).join('');

    return `<!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8">
        <title>Kardex ${tabLabel} — ${part.codigo_producto || part.codigo}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 2rem; color: #1e293b; font-size: 13px; }
            h1 { font-size: 1.4rem; color: #1e40af; margin-bottom: 0.25rem; }
            .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
            .meta { display: flex; gap: 2rem; margin-bottom: 1.5rem; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 6px; }
            .meta span { font-size: 0.85rem; color: #475569; }
            .meta strong { color: #1e293b; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            thead tr { background: #1e40af; color: white; }
            th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
            .footer { margin-top: 1.5rem; font-size: 0.75rem; color: #94a3b8; text-align: right; }
            @media print { body { padding: 1rem; } }
        </style>
    </head><body>
        <h1>📋 Kardex — ${tabLabel}</h1>
        <div class="subtitle">Historial de movimientos de inventario</div>
        <div class="meta">
            <span>Producto: <strong>${part.codigo_producto || part.name || '—'}</strong></span>
            <span>Código: <strong>${part.codigo || '—'}</strong></span>
            <span>Aplicación: <strong>${part.aplicacion || '—'}</strong></span>
            <span>Stock actual: <strong>${part.stock ?? '—'}</strong></span>
        </div>
        <table>
            <thead><tr>
                <th>Fecha</th><th>Tipo</th><th style="text-align:right">Cantidad</th>
                <th style="text-align:right">Precio</th><th>Concepto</th><th style="text-align:right">Saldo</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="footer">Generado el ${new Date().toLocaleString('es-EC')} — La Casa de los Retenes S y G</div>
        <script>setTimeout(() => { window.print(); }, 300);<\/script>
    </body></html>`;
}

function MovementTable({ movements }) {
    const cfg = (type) => TYPE_CONFIG[type] || { label: type, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: '📋' };

    if (movements.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <p style={{ fontSize: '2.5rem', margin: 0 }}>📭</p>
                <p style={{ marginTop: '0.5rem' }}>No hay registros en esta sección.</p>
            </div>
        );
    }

    return (
        <>
            {/* Table header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '140px 145px 75px 80px 1fr 70px',
                gap: '0.5rem', padding: '0.5rem 0.75rem',
                fontSize: '0.72rem', color: '#64748b', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '1px solid #334155', marginBottom: '0.5rem'
            }}>
                <span>Fecha</span>
                <span>Tipo</span>
                <span style={{ textAlign: 'right' }}>Cantidad</span>
                <span style={{ textAlign: 'right' }}>Precio</span>
                <span>Concepto</span>
                <span style={{ textAlign: 'right' }}>Saldo</span>
            </div>

            {/* Rows */}
            {movements.map((m, i) => {
                const c = cfg(m.type);
                const qty = Math.abs(m.quantity);
                const isNegative = m.quantity < 0;
                return (
                    <div
                        key={m.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '140px 145px 75px 80px 1fr 70px',
                            gap: '0.5rem',
                            padding: '0.65rem 0.75rem',
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            borderRadius: '0.4rem',
                            alignItems: 'center',
                            fontSize: '0.85rem'
                        }}
                    >
                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                            {formatDate(m.created_at)}
                        </span>

                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            background: c.bg, color: c.color,
                            padding: '0.2rem 0.5rem', borderRadius: '999px',
                            fontSize: '0.73rem', fontWeight: 600,
                            border: `1px solid ${c.color}33`,
                            whiteSpace: 'nowrap', overflow: 'hidden'
                        }}>
                            {c.icon} {c.label}
                        </span>

                        <span style={{
                            textAlign: 'right', fontWeight: 700,
                            color: isNegative ? '#ef4444' : '#22c55e',
                            fontSize: '0.9rem'
                        }}>
                            {isNegative ? '-' : '+'}{qty}
                        </span>

                        <span style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem' }}>
                            {m.price > 0 ? `Bs. ${m.price.toFixed(2)}` : '—'}
                        </span>

                        <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>
                            {m.concept || '—'}
                        </span>

                        <span style={{
                            textAlign: 'right', fontWeight: 700,
                            color: m.balance <= 0 ? '#ef4444' : m.balance <= 5 ? '#f97316' : '#38bdf8',
                            fontSize: '0.9rem'
                        }}>
                            {m.balance}
                        </span>
                    </div>
                );
            })}
        </>
    );
}

export default function KardexModal({ part, onClose }) {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('commercial'); // 'commercial' | 'manual'

    useEffect(() => {
        if (!part) return;
        setLoading(true);
        setActiveTab('commercial');
        fetch(`/api/kardex/${part.id}`)

            .then(r => r.json())
            .then(data => {
                if (data.message === 'success') setMovements(data.data);
                else setError(data.error || 'Error cargando kardex');
            })
            .catch(() => setError('No se pudo conectar al servidor'))
            .finally(() => setLoading(false));
    }, [part]);

    if (!part) return null;

    const commercialMovements = movements.filter(m => COMMERCIAL_TYPES.has(m.type));
    const manualMovements = movements.filter(m => MANUAL_TYPES.has(m.type) || !COMMERCIAL_TYPES.has(m.type) && !MANUAL_TYPES.has(m.type));

    const activeMovements = activeTab === 'commercial' ? commercialMovements : manualMovements;
    const tabLabel = activeTab === 'commercial' ? '📦 Ventas y Movimientos' : '🛠️ Registros Manuales';

    const totalVendido = commercialMovements.filter(m => m.type === 'VENTA').reduce((s, m) => s + Math.abs(m.quantity), 0);
    const totalIngresado = manualMovements.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0);

    const tabStyle = (tab) => ({
        padding: '0.55rem 1.1rem',
        fontSize: '0.88rem',
        fontWeight: 600,
        borderRadius: '0.5rem 0.5rem 0 0',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...(activeTab === tab ? {
            background: '#1e293b',
            color: activeTab === tab && tab === 'commercial' ? '#38bdf8' : '#a78bfa',
            borderBottom: `2px solid ${tab === 'commercial' ? '#38bdf8' : '#a78bfa'}`,
        } : {
            background: 'transparent',
            color: '#64748b',
            borderBottom: '2px solid transparent',
        })
    });

    const badgeStyle = (count, tab) => ({
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: activeTab === tab
            ? (tab === 'commercial' ? 'rgba(56,189,248,0.2)' : 'rgba(167,139,250,0.2)')
            : 'rgba(100,116,139,0.2)',
        color: activeTab === tab
            ? (tab === 'commercial' ? '#38bdf8' : '#a78bfa')
            : '#64748b',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 700,
        minWidth: '20px',
        height: '20px',
        padding: '0 6px',
        marginLeft: '6px',
    });

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                zIndex: 9000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: '1rem', width: '100%', maxWidth: '860px',
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
                }}
            >
                {/* ── Header ── */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #334155',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    flexShrink: 0
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '1.4rem' }}>
                            📋 Kardex del Producto
                        </h2>
                        <p style={{ margin: '0.3rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                            <strong style={{ color: '#f8fafc' }}>{part.codigo_producto || part.codigo || part.name}</strong>
                            {part.aplicacion ? ` — ${part.aplicacion}` : ''}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            onClick={() => {
                                const win = window.open('', '_blank');
                                win.document.write(buildPrintHtml(part, activeMovements, tabLabel));
                                win.document.close();
                            }}
                            disabled={activeMovements.length === 0}
                            style={{
                                background: activeMovements.length === 0 ? 'rgba(100,116,139,0.2)' : 'rgba(16,185,129,0.15)',
                                border: `1px solid ${activeMovements.length === 0 ? '#334155' : '#10b981'}`,
                                color: activeMovements.length === 0 ? '#475569' : '#34d399',
                                borderRadius: '0.5rem', padding: '0.4rem 0.9rem',
                                cursor: activeMovements.length === 0 ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                transition: 'all 0.2s'
                            }}
                            title="Imprimir la pestaña activa"
                        >
                            🖨️ Imprimir
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent', border: '1px solid #334155',
                                color: '#94a3b8', borderRadius: '0.5rem',
                                padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '1rem'
                            }}
                        >✕</button>
                    </div>
                </div>

                {/* ── Stats bar ── */}
                <div style={{
                    padding: '0.65rem 1.5rem',
                    background: 'rgba(56,189,248,0.05)',
                    borderBottom: '1px solid #334155',
                    display: 'flex', gap: '2rem', flexShrink: 0, flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Stock actual: <strong style={{ color: '#22c55e', fontSize: '1rem' }}>{part.stock ?? '—'}</strong>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Total movimientos: <strong style={{ color: '#38bdf8' }}>{movements.length}</strong>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Total vendido: <strong style={{ color: '#ef4444' }}>{totalVendido} uds.</strong>
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        Total ingresado: <strong style={{ color: '#22c55e' }}>{totalIngresado} uds.</strong>
                    </span>
                </div>

                {/* ── Tabs ── */}
                <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    padding: '0.75rem 1.5rem 0',
                    borderBottom: '1px solid #334155',
                    flexShrink: 0,
                    background: 'rgba(0,0,0,0.15)'
                }}>
                    <button style={tabStyle('commercial')} onClick={() => setActiveTab('commercial')}>
                        📦 Ventas y Movimientos
                        <span style={badgeStyle(commercialMovements.length, 'commercial')}>
                            {commercialMovements.length}
                        </span>
                    </button>
                    <button style={tabStyle('manual')} onClick={() => setActiveTab('manual')}>
                        🛠️ Registros Manuales
                        <span style={badgeStyle(manualMovements.length, 'manual')}>
                            {manualMovements.length}
                        </span>
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                            Cargando historial...
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{
                            padding: '1rem', borderRadius: '0.5rem',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
                            color: '#fca5a5', textAlign: 'center'
                        }}>{error}</div>
                    )}

                    {!loading && !error && (
                        <MovementTable movements={activeMovements} />
                    )}
                </div>
            </div>
        </div>
    );
}
