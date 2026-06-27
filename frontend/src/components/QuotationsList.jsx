import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Download, Wrench, CheckCircle, X, ChevronUp, ChevronDown, Inbox, Loader2 } from 'lucide-react';
import { toast } from '../lib/toast';
import * as api from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import { SkeletonTable } from './Skeleton';

const STATUS_LABEL = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada' };
const STATUS_COLOR = { pending: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444' };

export default function QuotationsList() {
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [detail, setDetail] = useState({});
    const [confirming, setConfirming] = useState(null);
    const [filter, setFilter] = useState('all');
    const [confirmModal, setConfirmModal] = useState(null);

    const fetchQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getQuotations();
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
                const data = await api.getQuotation(id);
                if (data.message === 'success') setDetail(prev => ({ ...prev, [id]: data.data }));
            } catch { toast.error('Error cargando detalle'); }
        }
    };

    const doConfirm = async (id) => {
        setConfirmModal(null);
        setConfirming(id);
        try {
            await api.confirmQuotation(id);
            toast.success('Cotización confirmada como venta mayorista');
            fetchQuotations();
            setDetail(prev => { const d = { ...prev }; delete d[id]; return d; });
        } catch { toast.error('Error de conexión'); }
        finally { setConfirming(null); }
    };

    const handleConfirm = (id) => setConfirmModal({
        message: '¿Confirmar esta cotización como venta mayorista? Se descontará el stock.',
        danger: false,
        onConfirm: () => doConfirm(id),
    });

    const doCancel = async (id) => {
        setConfirmModal(null);
        try {
            await api.cancelQuotation(id);
            toast.success('Cotización cancelada');
            fetchQuotations();
        } catch { toast.error('Error de conexión'); }
    };

    const handleCancel = (id) => setConfirmModal({
        message: '¿Cancelar esta cotización?',
        danger: true,
        onConfirm: () => doCancel(id),
    });

    const fmtDate = (d) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filtered = filter === 'all' ? quotations : quotations.filter(q => q.status === filter);

    return (
        <div className="card" style={{ padding: '1.5rem' }}>
            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    danger={confirmModal.danger}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '7px' }}><FileText size={18} /> Cotizaciones</h2>
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
                    <button onClick={fetchQuotations} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <RefreshCw size={13} /> Actualizar
                    </button>
                </div>
            </div>

            {loading && <SkeletonTable rows={6} cols={5} />}
            {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Inbox size={36} strokeWidth={1.2} />
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
                        {expanded === q.id ? <ChevronUp size={15} color="var(--text-secondary)" /> : <ChevronDown size={15} color="var(--text-secondary)" />}
                    </div>

                    {/* Expanded detail */}
                    {expanded === q.id && (
                        <div style={{ borderTop: '1px solid #334155', padding: '0.75rem 1rem', backgroundColor: 'rgba(0,0,0,0.15)' }}>
                            {!detail[q.id] ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando ítems...</p>
                            ) : (
                                <>
                                    <div className="table-scroll">
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
                                    </div>
                                    {detail[q.id].notes && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                            <strong>Notas:</strong> {detail[q.id].notes}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => api.downloadQuotationPdf(q.id, 'cliente').catch(err => toast.error(err.message))}
                                            style={{ padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <Download size={13} /> PDF Cliente
                                        </button>
                                        <button
                                            onClick={() => api.downloadQuotationPdf(q.id, 'interno').catch(err => toast.error(err.message))}
                                            style={{ padding: '6px 14px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <Wrench size={13} /> PDF Interno
                                        </button>
                                        {q.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleConfirm(q.id)}
                                                    disabled={confirming === q.id}
                                                    style={{ padding: '6px 14px', backgroundColor: confirming === q.id ? '#475569' : '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: confirming === q.id ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                >
                                                    {confirming === q.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</> : <><CheckCircle size={13} /> Confirmar Venta</>}
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(q.id)}
                                                    style={{ padding: '6px 14px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <X size={13} /> Cancelar
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
