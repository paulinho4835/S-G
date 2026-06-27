import React, { useState, useEffect } from 'react';
import { Truck, Search, X, Inbox, User, Calendar, CheckCircle, CornerDownLeft, Download } from 'lucide-react';
import { toast } from '../lib/toast';
import * as api from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import { SkeletonTable } from './Skeleton';

export default function WholesaleHistory() {
    const [orders, setOrders]         = useState([]);
    const [search, setSearch]         = useState('');
    const [loading, setLoading]       = useState(false);
    const [expanded, setExpanded]     = useState(null); // order id expanded
    const [orderDetail, setOrderDetail] = useState({}); // { [id]: items }
    const [confirmModal, setConfirmModal] = useState(null);

    const fetchOrders = async (clienteFilter = '') => {
        setLoading(true);
        try {
            const data = await api.getWholesaleOrders(clienteFilter ? { cliente: clienteFilter } : {});
            if (data.message === 'success') setOrders(data.data);
        } catch (err) {
            toast.error('Error cargando historial mayorista');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchOrders(search.trim());
    };

    const toggleExpand = async (orderId) => {
        if (expanded === orderId) { setExpanded(null); return; }
        setExpanded(orderId);
        if (orderDetail[orderId]) return; // ya cargado

        try {
            const data = await api.getWholesaleOrder(orderId);
            if (data.message === 'success') {
                setOrderDetail(prev => ({ ...prev, [orderId]: data.data.items }));
            }
        } catch (err) {
            toast.error('Error cargando detalle del pedido');
        }
    };

    const doReturn = async (orderId) => {
        setConfirmModal(null);
        try {
            await api.returnWholesaleOrder(orderId);
            toast.success('Pedido devuelto. Stock restaurado.');
            fetchOrders(search.trim());
            setOrderDetail(prev => { const n = { ...prev }; delete n[orderId]; return n; });
        } catch (err) {
            toast.error('Error al procesar devolución');
        }
    };

    const handleReturn = (orderId) => setConfirmModal({
        message: '¿Devolver este pedido? Se restaurará el stock de todos sus ítems.',
        danger: true,
        onConfirm: () => doReturn(orderId),
    });

    const fmt = (n) => parseFloat(n || 0).toFixed(2);
    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + dt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="glass-panel" style={{ marginTop: '1.5rem' }}>
            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    danger={confirmModal.danger}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
            {/* Header + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, color: '#f59e0b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Truck size={18} /> Historial de Ventas por Mayor
                </h2>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por cliente..."
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'var(--text-primary)', width: '220px' }}
                    />
                    <button type="submit" className="primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Search size={13} /> Buscar
                    </button>
                    {search && (
                        <button type="button" onClick={() => { setSearch(''); fetchOrders(); }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', backgroundColor: '#475569', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </form>
            </div>

            {loading && <SkeletonTable rows={6} cols={5} />}

            {!loading && orders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Inbox size={40} strokeWidth={1.2} />
                    <p>{search ? `No se encontraron pedidos para "${search}"` : 'Aún no hay ventas por mayor registradas.'}</p>
                </div>
            )}

            {!loading && orders.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {orders.map(order => (
                        <div key={order.id} style={{
                            border: `1px solid ${order.status === 'returned' ? '#7f1d1d' : '#334155'}`,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: order.status === 'returned' ? 'rgba(127, 29, 29, 0.08)' : 'rgba(255,255,255,0.02)'
                        }}>
                            {/* Fila cabecera */}
                            <div
                                onClick={() => toggleExpand(order.id)}
                                style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer', gap: '1rem', flexWrap: 'wrap' }}
                            >
                                {/* Expand arrow */}
                                <span style={{ color: 'var(--text-secondary)', minWidth: '16px', display: 'flex' }}>
                                    {expanded === order.id
                                        ? <X size={13} />
                                        : <Search size={13} />}
                                </span>

                                <span style={{ fontWeight: 'bold', color: '#f59e0b', minWidth: '60px', fontSize: '0.9rem' }}>
                                    #{order.id}
                                </span>

                                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', flex: 1, minWidth: '120px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <User size={13} color="var(--text-secondary)" /> {order.cliente}
                                </span>

                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: '130px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} /> {fmtDate(order.order_date)}
                                </span>

                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    backgroundColor: order.status === 'returned' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                                    color: order.status === 'returned' ? '#f87171' : '#34d399'
                                }}>
                                    {order.status === 'returned'
                                        ? <><CornerDownLeft size={11} /> Devuelto</>
                                        : <><CheckCircle size={11} /> Activo</>}
                                </span>

                                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.05rem', minWidth: '100px', textAlign: 'right' }}>
                                    Bs. {fmt(order.total)}
                                </span>

                                {order.status !== 'returned' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleReturn(order.id); }}
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: '1px solid #ef4444',
                                            color: '#ef4444',
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            whiteSpace: 'nowrap',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        <CornerDownLeft size={12} /> Devolver
                                    </button>
                                )}
                            </div>

                            {/* Detalle expandido */}
                            {expanded === order.id && (
                                <div style={{ borderTop: '1px solid #334155', padding: '0.75rem 1rem', backgroundColor: 'rgba(0,0,0,0.15)' }}>
                                    {!orderDetail[order.id] ? (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando ítems...</p>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                                                    Comprobante: <strong>{
                                                        order.invoice_type === 'MAYOR_SIN_FACTURA' ? 'Venta x Mayor Sin Factura' :
                                                        order.invoice_type === 'MAYOR_SIN_FACTURA_QR' ? 'Venta x Mayor Sin Factura QR' :
                                                        order.invoice_type === 'MAYOR_FACTURA' ? 'Venta x Mayor Factura' :
                                                        order.invoice_type === 'MAYOR_FACTURA_QR' ? 'Venta x Mayor Factura QR' :
                                                        order.invoice_type || 'Sin Factura'
                                                    }</strong>
                                                    {order.notes ? ` · Notas: ${order.notes}` : ''}
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        const items = orderDetail[order.id];
                                                        if (!items || items.length === 0) return;

                                                        const runPdfDownload = () => {
                                                            const rowsHtml = items.map((item, i) => {
                                                                const product = item.codigo_producto || item.name || '—';
                                                                const measures = `${item.internal_measure || '—'} × ${item.external_measure || '—'} × ${item.height || '—'}`;
                                                                const subtotal = item.quantity * item.unit_price;
                                                                return `
                                                                    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}; border-bottom: 1px solid #dddddd;">
                                                                        <td style="padding:10px;font-weight:bold;color:#000000;text-align:left;">${product}</td>
                                                                        <td style="padding:10px;color:#333333;text-align:left;">${measures}</td>
                                                                        <td style="padding:10px;text-align:center;font-weight:bold;color:#000000;">${item.quantity}</td>
                                                                        <td style="padding:10px;text-align:right;color:#000000;">Bs. ${fmt(item.unit_price)}</td>
                                                                        <td style="padding:10px;text-align:right;font-weight:bold;color:#000000;">Bs. ${fmt(subtotal)}</td>
                                                                    </tr>`;
                                                            }).join('');

                                                            const printContainer = document.createElement('div');
                                                            printContainer.style.padding = '40px';
                                                            printContainer.style.background = '#ffffff';
                                                            printContainer.style.fontFamily = 'Arial, sans-serif';
                                                            printContainer.style.color = '#000000';
                                                            printContainer.style.fontSize = '12px';

                                                            printContainer.innerHTML = `
                                                                <div style="text-align:center; margin-bottom: 30px; border-bottom: 2px solid #000000; padding-bottom: 15px;">
                                                                    <div style="font-size: 24px; font-weight: bold; color: #000000; letter-spacing: 1px;">LA CASA DE LOS RETENES S Y G</div>
                                                                    <div style="font-size: 14px; font-weight: bold; color: #333333; text-transform: uppercase; margin-top: 5px;">Nota de Venta al por Mayor</div>
                                                                </div>
                                                                
                                                                <div style="margin-bottom: 25px; background: #f5f5f5; padding: 15px; border-radius: 6px; border: 1px solid #dddddd; line-height: 1.6; font-size: 13px;">
                                                                    <div>Cliente: <strong style="font-size:14px; color:#000000;">${order.cliente}</strong></div>
                                                                    <div>Fecha de Emisión: <strong>${fmtDate(order.order_date)}</strong></div>
                                                                    ${order.notes ? `<div>Notas: <strong>${order.notes}</strong></div>` : ''}
                                                                </div>
                                                                
                                                                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; border: 1px solid #dddddd;">
                                                                    <thead>
                                                                        <tr style="background: #000000; color: #ffffff;">
                                                                            <th style="padding: 10px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 11px;">Producto</th>
                                                                            <th style="padding: 10px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 11px;">Medidas</th>
                                                                            <th style="padding: 10px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 11px;">Cant.</th>
                                                                            <th style="padding: 10px; text-align: right; font-weight: bold; text-transform: uppercase; font-size: 11px;">P. Unit.</th>
                                                                            <th style="padding: 10px; text-align: right; font-weight: bold; text-transform: uppercase; font-size: 11px;">Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        ${rowsHtml}
                                                                        <tr style="background: #eaeaea; font-weight: bold; font-size: 13px; border-top: 2px solid #000000;">
                                                                            <td colspan="4" style="padding: 12px 10px; text-align: right; color: #000000;">TOTAL GENERAL:</td>
                                                                            <td style="padding: 12px 10px; text-align: right; color: #000000;">Bs. ${fmt(order.total)}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            `;

                                                            const cleanClientName = order.cliente.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                                            const opt = {
                                                                margin:       [0.5, 0.5, 0.5, 0.5],
                                                                filename:     `nota_venta_${cleanClientName}_pedido_${order.id}.pdf`,
                                                                image:        { type: 'jpeg', quality: 0.98 },
                                                                html2canvas:  { scale: 2, useCORS: true },
                                                                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                                                            };

                                                            window.html2pdf().from(printContainer).set(opt).save();
                                                        };

                                                        if (window.html2pdf) {
                                                            runPdfDownload();
                                                        } else {
                                                            const script = document.createElement('script');
                                                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                                                            script.onload = runPdfDownload;
                                                            document.body.appendChild(script);
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'rgba(56,189,248,0.15)',
                                                        border: '1px solid #38bdf8',
                                                        color: '#38bdf8',
                                                        borderRadius: '4px',
                                                        padding: '4px 10px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '600',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem'
                                                    }}
                                                >
                                                    <Download size={13} /> Descargar PDF
                                                </button>
                                            </div>
                                            <div className="table-scroll">
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                                <thead>
                                                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid #334155' }}>
                                                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>Producto</th>
                                                        <th style={{ textAlign: 'left', padding: '4px 8px' }}>Medidas</th>
                                                        <th style={{ textAlign: 'center', padding: '4px 8px' }}>Cant.</th>
                                                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>P. Unit.</th>
                                                        <th style={{ textAlign: 'right', padding: '4px 8px' }}>Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderDetail[order.id].map(item => (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                                                            <td style={{ padding: '5px 8px', color: 'var(--accent-color)', fontWeight: '500' }}>
                                                                {item.codigo_producto || item.name}
                                                            </td>
                                                            <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>
                                                                {item.internal_measure}×{item.external_measure}×{item.height}
                                                            </td>
                                                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.quantity}</td>
                                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#f59e0b' }}>
                                                                Bs. {fmt(item.unit_price)}
                                                            </td>
                                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>
                                                                Bs. {fmt(item.total_price)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            Total del Pedido:
                                                        </td>
                                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#10b981', fontWeight: 'bold', fontSize: '1rem' }}>
                                                            Bs. {fmt(order.total)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
