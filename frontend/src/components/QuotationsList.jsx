import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada' };
const STATUS_COLOR = { pending: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444' };

async function downloadPDF(id) {
    try {
        const res = await fetch(`/api/quotations/${id}/pdf`);
        if (!res.ok) throw new Error('Error generando PDF');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cotizacion-${String(id).padStart(4, '0')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        toast.error('Error descargando PDF: ' + err.message);
    }
}

export default function QuotationsList() {
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [detail, setDetail] = useState({});
    const [confirming, setConfirming] = useState(null);
    const [filter, setFilter] = useState('all');

    const fetchQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/quotations');
            const data = await res.json();
            if (data.message === 'success') setQuotations(data.data);
        } catch {
            toast.error('Error cargando cotizaciones');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

    const toggleExpand = async (id) => {
        if (expanded === id) { setExpanded(null); return; }
        setExpanded(id);
        if (!detail[id]) {
            try {
                const res = await fetch(`/api/quotations/${id}`);
                const data = await res.json();
                if (data.message === 'success') setDetail(prev => ({ ...prev, [id]: data.data }));
            } catch { toast.error('Error cargando detalle'); }
        }
    };

    const handleConfirm = async (id) => {
        if (!window.confirm('¿Confirmar esta cotización como venta mayorista? Se descontará el stock.')) return;
        setConfirming(id);
        try {
            const res = await fetch(`/api/quotations/${id}/confirm`, { method: 'POST' });
            const data = await res.json();
            if (data.message === 'success') {
                toast.success(`✅ Venta Mayorista #${data.data.id} confirmada — Bs. ${data.data.total.toFixed(2)}`);
                fetchQuotations();
                setDetail(prev => { const d = { ...prev }; delete d[id]; return d; });
            } else {
                toast.error('Error: ' + data.error);
            }
        } catch { toast.error('Error de conexión'); }
        finally { setConfirming(null); }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('¿Cancelar esta cotización?')) return;
        try {
            const res = await fetch(`/api/quotations/${id}/cancel`, { method: 'POST' });
            const data = await res.json();
            if (data.message === 'success') {
                toast.success('Cotización cancelada');
                fetchQuotations();
            } else {
                toast.error('Error: ' + data.error);
            }
        } catch { toast.error('Error de conexión'); }
    };

    const fmtDate = (d) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filtered = filter === 'all' ? quotations : quotations.filter(q => q.status === filter);

    return (
        <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--accent-color)' }}>📋 Cotizaciones</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{ padding: '0.4rem 0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    >
                        <option value="all">Todas</option>
                        <option value="pending">Pendientes</option>
                        <option value="confirmed">Confirmadas</option>
                        <option value="cancelled">Canceladas</option>
                    </select>
                    <button onClick={fetchQuotations} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                        🔄 Actualizar
                    </button>
                </div>
            </div>

            {loading && <p style={{ color: 'var(--text-secondary)' }}>Cargando...</p>}
            {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
                    <p>No hay cotizaciones {filter !== 'all' ? `con estado "${STATUS_LABEL[filter]}"` : ''}.</p>
                </div>
            )}

            {!loading && filtered.map(q => (
                <div key={q.id} style={{ border: '1px solid #334155', borderRadius: '8px', marginBottom: '0.75rem', overflow: 'hidden' }}>
                    {/* Row header */}
                    <div
                        onClick={() => toggleExpand(q.id)}
                        style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer', backgroundColor: expanded === q.id ? 'rgba(245,158,11,0.06)' : 'transparent', gap: '0.75rem', flexWrap: 'wrap' }}
                    >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: '60px' }}>
                            #{String(q.id).padStart(4, '0')}
                        </span>
                        <span style={{ fontWeight: 'bold', flex: 1, minWidth: '120px' }}>{q.cliente}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{fmtDate(q.quote_date)}</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold', minWidth: '100px', textAlign: 'right' }}>
                            Bs. {parseFloat(q.total).toFixed(2)}
                        </span>
                        <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: STATUS_COLOR[q.status] + '22', color: STATUS_COLOR[q.status], border: `1px solid ${STATUS_COLOR[q.status]}44`, minWidth: '90px', textAlign: 'center' }}>
                            {STATUS_LABEL[q.status]}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{expanded === q.id ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded detail */}
                    {expanded === q.id && (
                        <div style={{ borderTop: '1px solid #334155', padding: '0.75rem 1rem', backgroundColor: 'rgba(0,0,0,0.15)' }}>
                            {!detail[q.id] ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando ítems...</p>
                            ) : (
                                <>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                        <thead>
                                            <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid #334155' }}>
                                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Código</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Descripción</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Cant.</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'right' }}>P.Unit Bs.</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'right' }}>Subtotal Bs.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail[q.id].items.map((item, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                                                    <td style={{ padding: '4px 8px', color: 'var(--accent-color)' }}>{item.codigo_producto || item.codigo || '-'}</td>
                                                    <td style={{ padding: '4px 8px' }}>
                                                        {item.name && <span>{item.name} </span>}
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>({item.internal_measure}×{item.external_measure}×{item.height})</span>
                                                    </td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.quantity}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{parseFloat(item.unit_price).toFixed(2)}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#10b981' }}>{(item.quantity * item.unit_price).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {detail[q.id].notes && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                            <strong>Notas:</strong> {detail[q.id].notes}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => downloadPDF(q.id)}
                                            style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                                        >
                                            📄 Ver / Descargar PDF
                                        </button>
                                        {q.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleConfirm(q.id)}
                                                    disabled={confirming === q.id}
                                                    style={{ padding: '6px 14px', backgroundColor: confirming === q.id ? '#475569' : '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: confirming === q.id ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                                                >
                                                    {confirming === q.id ? '⏳ Procesando...' : '✅ Confirmar Venta'}
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(q.id)}
                                                    style={{ padding: '6px 14px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' }}
                                                >
                                                    ✕ Cancelar
                                                </button>
                                            </>
                                        )}
                                        {q.status === 'confirmed' && q.wholesale_order_id && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                                → Venta Mayorista #{q.wholesale_order_id}
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
