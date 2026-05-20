import React, { useState, useEffect } from 'react';
import ConfirmDialog from './ConfirmDialog';

export default function OrdersList() {
    const [orders, setOrders] = useState([]);
    const [quantities, setQuantities] = useState({}); // { order_id: qty }
    const [confirmModal, setConfirmModal] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('pedidos_list');
        if (saved) {
            const parsedOrders = JSON.parse(saved);
            parsedOrders.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
            setOrders(parsedOrders);
        }
        const savedQty = localStorage.getItem('pedidos_quantities');
        if (savedQty) {
            setQuantities(JSON.parse(savedQty));
        }
    }, []);

    const updateOrders = (newOrders) => {
        setOrders(newOrders);
        localStorage.setItem('pedidos_list', JSON.stringify(newOrders));
    };

    const updateQuantity = (order_id, value) => {
        const newQty = { ...quantities, [order_id]: value };
        setQuantities(newQty);
        localStorage.setItem('pedidos_quantities', JSON.stringify(newQty));
    };

    const handleDelete = (id) => {
        const newOrders = orders.filter(o => o.order_id !== id);
        const newQty = { ...quantities };
        delete newQty[id];
        updateOrders(newOrders);
        setQuantities(newQty);
        localStorage.setItem('pedidos_quantities', JSON.stringify(newQty));
    };

    const handleClear = () => {
        setConfirmModal({
            message: '¿Estás seguro de que deseas vaciar toda la lista de pedidos?',
            onConfirm: () => {
                updateOrders([]);
                setQuantities({});
                localStorage.removeItem('pedidos_quantities');
                setConfirmModal(null);
            }
        });
    };

    const handleExportText = () => {
        if (orders.length === 0) return;
        const header = `LISTA DE PEDIDOS\nFecha: ${new Date().toLocaleString()}\n` + '='.repeat(50) + '\n\n';
        const lines = orders.map(p => {
            const qty = quantities[p.order_id] || '';
            return [
                `Código:          ${p.codigo || '-'}`,
                `Producto:        ${p.codigo_producto || p.name || '-'}`,
                `Medidas MI/ME/ALT: ${p.internal_measure ?? '-'} / ${p.external_measure ?? '-'} / ${p.height ?? '-'}`,
                `Cantidad a pedir: ${qty || '(sin especificar)'}`,
                '-'.repeat(40)
            ].join('\n');
        }).join('\n');

        const blob = new Blob([header + lines], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'lista_pedidos.txt'; a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportWhatsApp = () => {
        if (orders.length === 0) return;
        const header = `*LISTA DE PEDIDOS*\nFecha: ${new Date().toLocaleString()}\n` + '========================\n\n';
        const lines = orders.map(p => {
            const qty = quantities[p.order_id] || '(sin especificar)';
            return `*Código:* ${p.codigo || '-'}\n*Producto:* ${p.codigo_producto || p.name || '-'}\n*Medidas:* ${p.internal_measure ?? '-'} / ${p.external_measure ?? '-'} / ${p.height ?? '-'}\n*Cantidad a pedir:* ${qty}\n------------------------`;
        }).join('\n\n');

        const text = encodeURIComponent(header + lines);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    return (
        <div className="card">
            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ margin: 0 }}>📦 Lista de Pedidos</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleExportText} className="primary" disabled={orders.length === 0} style={{ backgroundColor: '#10b981' }}>
                        📋 Exportar Texto
                    </button>
                    <button onClick={handleClear} className="danger" disabled={orders.length === 0}>
                        🗑️ Vaciar Lista
                    </button>
                </div>
            </div>

            {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: '2rem', margin: 0 }}>📭</p>
                    <p style={{ marginTop: '1rem' }}>No hay pedidos en la lista.<br /><span style={{ fontSize: '0.9rem' }}>Usa el botón <strong>📦 Pedido</strong> en la tabla de Productos.</span></p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--card-bg)' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #334155' }}>
                                <th style={{ padding: '12px 8px' }}>Fecha Pedido</th>
                                <th style={{ padding: '12px 8px' }}>Código</th>
                                <th style={{ padding: '12px 8px' }}>Producto</th>
                                <th style={{ padding: '12px 8px' }}>MI / ME / ALT</th>
                                <th style={{ padding: '12px 8px' }}>Stock Actual</th>
                                <th style={{ padding: '12px 8px' }}>Cantidad a Pedir</th>
                                <th style={{ padding: '12px 8px' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.order_id} style={{ borderBottom: '1px solid #334155' }}>
                                    <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {new Date(order.order_date).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        {order.codigo || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', fontSize: '0.9rem' }}>
                                        {order.codigo_producto || order.name || '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                                        {order.internal_measure || '0'} / {order.external_measure || '0'} / {order.height || '0'}
                                    </td>
                                    <td style={{ padding: '10px 8px' }}>
                                        <span style={{ color: (order.stock ?? 0) > 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                                            {order.stock ?? 0}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 8px' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Ej. 10"
                                            value={quantities[order.order_id] || ''}
                                            onChange={e => updateQuantity(order.order_id, e.target.value)}
                                            style={{
                                                width: '90px',
                                                padding: '5px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid #334155',
                                                background: 'rgba(255,255,255,0.05)',
                                                color: '#f8fafc',
                                                fontSize: '0.9rem',
                                                textAlign: 'center'
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '10px 8px' }}>
                                        <button
                                            onClick={() => handleDelete(order.order_id)}
                                            style={{ backgroundColor: '#ef4444', fontSize: '0.8rem', padding: '4px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                                        >
                                            Quitar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
