import React, { useState, useEffect } from 'react';
import { Truck, Download, Trash2, Inbox } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import * as api from '../lib/api';
import { toast } from '../lib/toast';

function readLegacyOrders() {
    try {
        const orders = JSON.parse(localStorage.getItem('pedidos_list') || '[]');
        const quantities = JSON.parse(localStorage.getItem('pedidos_quantities') || '{}');
        return {
            orders: Array.isArray(orders) ? orders : [],
            quantities: quantities && typeof quantities === 'object' ? quantities : {},
        };
    } catch (error) {
        console.error('Legacy orders could not be read:', error);
        return { orders: [], quantities: {} };
    }
}

function mapSupplyOrder(row) {
    const snapshot = row.product_snapshot && typeof row.product_snapshot === 'object'
        ? row.product_snapshot
        : {};
    return {
        ...snapshot,
        order_id: row.client_order_id,
        server_id: row.id,
        part_id: row.part_id,
        order_date: row.order_date,
        quantity: row.quantity,
    };
}

export default function OrdersList() {
    const [orders, setOrders] = useState([]);
    const [quantities, setQuantities] = useState({}); // { order_id: qty }
    const [confirmModal, setConfirmModal] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const loadOrders = async () => {
            const legacy = readLegacyOrders();
            try {
                // Importa la copia local una sola vez. El upsert es idempotente.
                if (legacy.orders.length > 0) {
                    await api.importSupplyOrders(legacy.orders, legacy.quantities);
                }

                const response = await api.getSupplyOrders();
                if (cancelled) return;

                const serverOrders = (response.data || []).map(mapSupplyOrder);
                const serverQuantities = Object.fromEntries(
                    serverOrders
                        .filter(order => order.quantity !== null && order.quantity !== undefined)
                        .map(order => [order.order_id, String(order.quantity)])
                );
                setOrders(serverOrders);
                setQuantities(serverQuantities);

                // Solo elimina la copia local después de confirmar que la lectura remota funcionó.
                if (legacy.orders.length > 0) {
                    localStorage.removeItem('pedidos_list');
                    localStorage.removeItem('pedidos_quantities');
                }
            } catch (error) {
                console.error('Error loading shared orders:', error);
                if (cancelled) return;
                setOrders(legacy.orders);
                setQuantities(legacy.quantities);
                toast.error(legacy.orders.length > 0
                    ? 'No se pudo sincronizar; se muestra la copia local.'
                    : 'No se pudo cargar la lista de pedidos.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadOrders();
        return () => { cancelled = true; };
    }, []);

    const saveLocalBackup = (newOrders, newQuantities) => {
        localStorage.setItem('pedidos_list', JSON.stringify(newOrders));
        localStorage.setItem('pedidos_quantities', JSON.stringify(newQuantities));
    };

    const updateQuantity = (order_id, value) => {
        const newQty = { ...quantities, [order_id]: value };
        setQuantities(newQty);
        const order = orders.find(item => item.order_id === order_id);
        if (!order?.server_id) saveLocalBackup(orders, newQty);
    };

    const saveQuantity = async (order_id) => {
        const order = orders.find(item => item.order_id === order_id);
        if (!order?.server_id) return;
        try {
            await api.updateSupplyOrder(order.server_id, quantities[order_id] ?? '');
        } catch (error) {
            console.error('Error updating supply order quantity:', error);
            saveLocalBackup(orders, quantities);
            toast.error('No se pudo sincronizar la cantidad; quedó guardada localmente.');
        }
    };

    const handleDelete = async (id) => {
        const order = orders.find(item => item.order_id === id);
        if (order?.server_id) {
            try {
                await api.deleteSupplyOrder(order.server_id);
            } catch (error) {
                console.error('Error deleting supply order:', error);
                toast.error('No se pudo quitar el pedido.');
                return;
            }
        }

        const newOrders = orders.filter(o => o.order_id !== id);
        const newQty = { ...quantities };
        delete newQty[id];
        setOrders(newOrders);
        setQuantities(newQty);
        if (!order?.server_id) saveLocalBackup(newOrders, newQty);
    };

    const handleClear = () => {
        setConfirmModal({
            message: '¿Estás seguro de que deseas vaciar toda la lista de pedidos?',
            onConfirm: async () => {
                try {
                    await Promise.all(
                        orders
                            .filter(order => order.server_id)
                            .map(order => api.deleteSupplyOrder(order.server_id))
                    );
                } catch (error) {
                    console.error('Error clearing supply orders:', error);
                    toast.error('No se pudo vaciar toda la lista.');
                    return;
                }
                setOrders([]);
                setQuantities({});
                localStorage.removeItem('pedidos_list');
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
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '7px' }}><Truck size={18} color="var(--accent-color)" /> Lista de Pedidos</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleExportText} className="primary" disabled={orders.length === 0} style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Download size={14} /> Exportar Texto
                    </button>
                    <button onClick={handleClear} className="danger" disabled={orders.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Trash2 size={14} /> Vaciar Lista
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Cargando pedidos...
                </div>
            ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Inbox size={40} strokeWidth={1.2} />
                    <p style={{ margin: 0 }}>No hay pedidos en la lista.<br /><span style={{ fontSize: '0.9rem' }}>Usa el botón <strong>Pedido</strong> en la tabla de Productos.</span></p>
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
                                            onBlur={() => saveQuantity(order.order_id)}
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
