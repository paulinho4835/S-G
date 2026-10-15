import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive, Download, FilterX, Inbox, RefreshCw, RotateCcw,
    Search, Truck, X,
} from 'lucide-react';
import * as api from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import { toast } from '../lib/toast';

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pendiente' },
    { value: 'ordered', label: 'Pedido enviado' },
    { value: 'received', label: 'Recibido' },
    { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_LABELS = Object.fromEntries(
    STATUS_OPTIONS.map(status => [status.value, status.label])
);

const STATUS_STYLES = {
    pending: { background: '#3f2d08', color: '#fbbf24' },
    ordered: { background: '#172554', color: '#93c5fd' },
    received: { background: '#064e3b', color: '#6ee7b7' },
    cancelled: { background: '#450a0a', color: '#fca5a5' },
};

const controlStyle = {
    background: '#111c2e',
    border: '1px solid #334155',
    borderRadius: '0.45rem',
    color: '#e2e8f0',
    minHeight: '2.25rem',
    padding: '0.45rem 0.65rem',
};

const compactInputStyle = {
    ...controlStyle,
    width: '100%',
    minWidth: '7rem',
};

function parseLocalJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function readLegacyOrders() {
    const rawOrders = parseLocalJson('pedidos_list', []);
    const quantities = parseLocalJson('pedidos_quantities', {});
    if (!Array.isArray(rawOrders)) return { orders: [], quantities: {} };

    const orders = rawOrders
        .map((order, index) => {
            const clientOrderId = String(
                order.client_order_id ?? order.order_id ??
                `legacy-${index}-${order.order_date || 'sin-fecha'}`
            ).trim();

            return {
                ...order,
                order_id: clientOrderId,
                client_order_id: clientOrderId,
                quantity: order.quantity ?? quantities[order.order_id] ?? '',
                status: order.status || 'pending',
                supplier: order.supplier || '',
                notes: order.notes || '',
                archived_at: null,
            };
        })
        .filter(order => order.order_id);

    return { orders, quantities: quantities && typeof quantities === 'object' ? quantities : {} };
}

function mapSupplyOrder(row) {
    const snapshot = row.product_snapshot || {};
    const clientOrderId = row.client_order_id || row.id;
    return {
        ...snapshot,
        order_id: clientOrderId,
        client_order_id: clientOrderId,
        server_id: row.id,
        part_id: row.part_id ?? snapshot.id ?? null,
        order_date: row.order_date,
        quantity: row.quantity ?? '',
        status: row.status || 'pending',
        supplier: row.supplier || '',
        notes: row.notes || '',
        closed_at: row.closed_at || null,
        archived_at: row.archived_at || null,
    };
}

function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha inválida';
    return date.toLocaleString('es-BO', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

function textValue(value) {
    return value === null || value === undefined ? '' : String(value);
}

function persistLocalBackup(orderList) {
    const activeOrders = orderList
        .filter(order => !order.archived_at)
        .map(order => {
            const { server_id, ...localOrder } = order;
            return {
                ...localOrder,
                order_id: localOrder.order_id || localOrder.client_order_id,
            };
        });

    if (activeOrders.length === 0) {
        localStorage.removeItem('pedidos_list');
        localStorage.removeItem('pedidos_quantities');
        return;
    }

    const quantities = Object.fromEntries(
        activeOrders.map(order => [order.order_id, order.quantity ?? ''])
    );
    localStorage.setItem('pedidos_list', JSON.stringify(activeOrders));
    localStorage.setItem('pedidos_quantities', JSON.stringify(quantities));
}

export default function OrdersList() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        from: '',
        to: '',
    });

    const loadOrders = useCallback(async () => {
        setLoading(true);
        const legacy = readLegacyOrders();

        try {
            if (legacy.orders.length > 0) {
                await api.importSupplyOrders(legacy.orders, legacy.quantities);
            }

            const response = await api.getSupplyOrders({ includeArchived: showArchived });
            setOrders((response.data || []).map(mapSupplyOrder));

            // El respaldo local se elimina únicamente después de confirmar la lectura de Supabase.
            if (legacy.orders.length > 0) {
                localStorage.removeItem('pedidos_list');
                localStorage.removeItem('pedidos_quantities');
            }
        } catch (error) {
            console.error('Error loading shared supply orders:', error);
            if (legacy.orders.length > 0) {
                setOrders(legacy.orders);
                toast.warning('Sin conexión con la lista compartida; se muestran los pedidos locales.');
            } else {
                setOrders([]);
                toast.error(`No se pudo cargar la lista de pedidos: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [showArchived]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(() => {
        const search = filters.search.trim().toLowerCase();

        return orders.filter(order => {
            if (filters.status !== 'all' && order.status !== filters.status) return false;

            const date = localDateKey(order.order_date);
            if (filters.from && (!date || date < filters.from)) return false;
            if (filters.to && (!date || date > filters.to)) return false;

            if (!search) return true;
            const haystack = [
                order.codigo,
                order.codigo_producto,
                order.name,
                order.supplier,
                order.notes,
                order.status,
                STATUS_LABELS[order.status],
            ].map(textValue).join(' ').toLowerCase();

            return haystack.includes(search);
        });
    }, [filters, orders]);

    const updateOrderState = (orderId, patch) => {
        setOrders(previous => previous.map(order => (
            order.order_id === orderId ? { ...order, ...patch } : order
        )));
    };

    const savePatch = async (orderId, patch) => {
        const currentOrder = orders.find(order => order.order_id === orderId);
        if (!currentOrder) return;

        if (!currentOrder.server_id) {
            const nextOrders = orders.map(order => (
                order.order_id === orderId ? { ...order, ...patch } : order
            ));
            setOrders(nextOrders);
            persistLocalBackup(nextOrders);
            return;
        }

        try {
            const response = await api.updateSupplyOrder(currentOrder.server_id, patch);
            if (response.data) {
                setOrders(previous => previous.map(order => (
                    order.order_id === orderId ? mapSupplyOrder(response.data) : order
                )));
            } else {
                updateOrderState(orderId, patch);
            }
        } catch (error) {
            console.error('Error updating shared supply order:', error);
            const nextOrders = orders.map(order => (
                order.order_id === orderId ? { ...order, ...patch } : order
            ));
            setOrders(nextOrders);
            persistLocalBackup(nextOrders);
            toast.warning('No se pudo sincronizar el cambio; quedó guardado localmente.');
        }
    };

    const handleQuantityChange = (orderId, quantity) => {
        updateOrderState(orderId, { quantity });
    };

    const handleQuantityBlur = (orderId) => {
        const order = orders.find(item => item.order_id === orderId);
        if (order) savePatch(orderId, { quantity: order.quantity });
    };

    const handleStatusChange = (orderId, status) => {
        updateOrderState(orderId, { status });
        savePatch(orderId, { status });
    };

    const handleTextChange = (orderId, field, value) => {
        updateOrderState(orderId, { [field]: value });
    };

    const handleTextBlur = (orderId, field) => {
        const order = orders.find(item => item.order_id === orderId);
        if (order) savePatch(orderId, { [field]: order[field] });
    };

    const handleArchive = async (orderId) => {
        const order = orders.find(item => item.order_id === orderId);
        if (!order) return;

        try {
            const archivedAt = new Date().toISOString();
            if (order.server_id) {
                await api.archiveSupplyOrder(order.server_id);
                setOrders(previous => showArchived
                    ? previous.map(item => item.order_id === orderId ? { ...item, archived_at: archivedAt } : item)
                    : previous.filter(item => item.order_id !== orderId));
            } else {
                setOrders(previous => {
                    const next = showArchived
                        ? previous.map(item => item.order_id === orderId ? { ...item, archived_at: archivedAt } : item)
                        : previous.filter(item => item.order_id !== orderId);
                    persistLocalBackup(next);
                    return next;
                });
            }
            toast.success('Pedido archivado. El historial se conserva.');
        } catch (error) {
            console.error('Error archiving supply order:', error);
            toast.error(`No se pudo archivar el pedido: ${error.message}`);
        }
    };

    const handleRestore = async (orderId) => {
        const order = orders.find(item => item.order_id === orderId);
        if (!order?.server_id) return;

        try {
            const response = await api.restoreSupplyOrder(order.server_id);
            const restored = response.data ? mapSupplyOrder(response.data) : { ...order, archived_at: null };
            setOrders(previous => previous.map(item => item.order_id === orderId ? restored : item));
            toast.success('Pedido restaurado a la lista activa.');
        } catch (error) {
            console.error('Error restoring supply order:', error);
            toast.error(`No se pudo restaurar el pedido: ${error.message}`);
        }
    };

    const handleArchiveAll = async () => {
        try {
            const hasServerOrders = orders.some(order => order.server_id && !order.archived_at);
            if (hasServerOrders) await api.archiveAllSupplyOrders();
            const archivedAt = new Date().toISOString();
            setOrders(previous => {
                const next = showArchived
                    ? previous.map(order => order.archived_at ? order : { ...order, archived_at: archivedAt })
                    : [];
                persistLocalBackup(next);
                return next;
            });
            localStorage.removeItem('pedidos_list');
            localStorage.removeItem('pedidos_quantities');
            setConfirmModal(null);
            toast.success('Lista activa archivada. Los pedidos siguen disponibles en el historial.');
        } catch (error) {
            console.error('Error archiving all supply orders:', error);
            setConfirmModal(null);
            toast.error(`No se pudo archivar la lista: ${error.message}`);
        }
    };

    const handleExport = () => {
        const lines = [
            'FECHA\tESTADO\tPROVEEDOR\tCODIGO\tPRODUCTO\tMEDIDAS\tSTOCK\tCANTIDAD\tNOTAS',
            ...filteredOrders.map(order => [
                formatDate(order.order_date),
                STATUS_LABELS[order.status] || order.status || 'Pendiente',
                textValue(order.supplier),
                textValue(order.codigo),
                textValue(order.codigo_producto || order.name),
                `${textValue(order.internal_measure)} / ${textValue(order.external_measure)} / ${textValue(order.height)}`,
                textValue(order.stock),
                textValue(order.quantity),
                textValue(order.notes),
            ].map(value => value.replace(/[\t\r\n]+/g, ' ')).join('\t')),
        ];

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pedidos-${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success(`${filteredOrders.length} pedido(s) exportado(s).`);
    };

    const clearFilters = () => setFilters({ search: '', status: 'all', from: '', to: '' });

    return (
        <div style={{ padding: '1.5rem', color: '#e2e8f0' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <Truck size={22} color="#fbbf24" />
                    <div>
                        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.35rem' }}>
                            Lista de Pedidos
                        </h2>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                            {filteredOrders.length} visible(s) · {showArchived ? 'incluye archivados' : 'lista activa'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleExport} style={{ ...controlStyle, cursor: 'pointer', color: '#6ee7b7' }}>
                        <Download size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        Exportar
                    </button>
                    <button type="button" onClick={loadOrders} disabled={loading} style={{ ...controlStyle, cursor: loading ? 'wait' : 'pointer' }}>
                        <RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowArchived(value => !value)}
                        style={{ ...controlStyle, cursor: 'pointer', color: showArchived ? '#93c5fd' : '#cbd5e1' }}
                    >
                        {showArchived ? <Inbox size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} /> : <Archive size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />}
                        {showArchived ? 'Ocultar archivados' : 'Ver historial'}
                    </button>
                    {!showArchived && orders.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setConfirmModal({
                                message: '¿Archivar toda la lista activa? Los pedidos no se eliminarán y podrás recuperarlos desde el historial.',
                                action: handleArchiveAll,
                            })}
                            style={{ ...controlStyle, cursor: 'pointer', color: '#fca5a5', borderColor: '#7f1d1d' }}
                        >
                            <Archive size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                            Archivar lista
                        </button>
                    )}
                </div>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto',
                gap: '0.6rem', alignItems: 'end', background: '#0f172a', border: '1px solid #1e293b',
                borderRadius: '0.7rem', padding: '0.8rem', marginBottom: '1rem',
            }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Buscar
                    <div style={{ position: 'relative', marginTop: 4 }}>
                        <Search size={15} color="#64748b" style={{ position: 'absolute', left: 9, top: 9 }} />
                        <input
                            value={filters.search}
                            onChange={event => setFilters(previous => ({ ...previous, search: event.target.value }))}
                            placeholder="Código, producto, proveedor..."
                            style={{ ...controlStyle, width: '100%', paddingLeft: '2rem' }}
                        />
                    </div>
                </label>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Estado
                    <select
                        value={filters.status}
                        onChange={event => setFilters(previous => ({ ...previous, status: event.target.value }))}
                        style={{ ...controlStyle, width: '100%', marginTop: 4 }}
                    >
                        <option value="all">Todos</option>
                        {STATUS_OPTIONS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                </label>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Desde
                    <input
                        type="date"
                        value={filters.from}
                        onChange={event => setFilters(previous => ({ ...previous, from: event.target.value }))}
                        style={{ ...controlStyle, width: '100%', marginTop: 4 }}
                    />
                </label>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Hasta
                    <input
                        type="date"
                        value={filters.to}
                        onChange={event => setFilters(previous => ({ ...previous, to: event.target.value }))}
                        style={{ ...controlStyle, width: '100%', marginTop: 4 }}
                    />
                </label>
                <button type="button" onClick={clearFilters} style={{ ...controlStyle, cursor: 'pointer', height: '2.25rem' }} title="Limpiar filtros">
                    <FilterX size={16} />
                </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '0.7rem' }}>
                <table style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', background: '#0b1422' }}>
                    <thead>
                        <tr style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left' }}>Fecha</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left' }}>Código</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left' }}>Producto</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left' }}>Medidas</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'center' }}>Stock</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'center' }}>Cantidad</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left' }}>Estado</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left', width: '10rem' }}>Proveedor</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'left', width: '13rem' }}>Notas</th>
                            <th style={{ padding: '0.85rem 0.65rem', textAlign: 'center' }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan="10" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>Cargando pedidos...</td></tr>
                        )}
                        {!loading && filteredOrders.length === 0 && (
                            <tr>
                                <td colSpan="10" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Inbox size={28} style={{ display: 'block', margin: '0 auto 0.5rem', color: '#64748b' }} />
                                    {orders.length === 0 ? 'No hay pedidos guardados.' : 'No hay pedidos que coincidan con los filtros.'}
                                </td>
                            </tr>
                        )}
                        {!loading && filteredOrders.map(order => {
                            const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                            const isArchived = Boolean(order.archived_at);
                            return (
                                <tr key={order.order_id} style={{ borderTop: '1px solid #1e293b', opacity: isArchived ? 0.72 : 1 }}>
                                    <td style={{ padding: '0.7rem 0.65rem', color: '#93c5fd', whiteSpace: 'nowrap' }}>{formatDate(order.order_date)}</td>
                                    <td style={{ padding: '0.7rem 0.65rem', fontWeight: 600 }}>{order.codigo || '-'}</td>
                                    <td style={{ padding: '0.7rem 0.65rem', color: '#c4b5fd' }}>{order.codigo_producto || order.name || '-'}</td>
                                    <td style={{ padding: '0.7rem 0.65rem', whiteSpace: 'nowrap' }}>
                                        {textValue(order.internal_measure)} / {textValue(order.external_measure)} / {textValue(order.height)}
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem', textAlign: 'center', color: Number(order.stock) > 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                                        {textValue(order.stock) || '0'}
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={order.quantity}
                                            placeholder="Ej. 10"
                                            onChange={event => handleQuantityChange(order.order_id, event.target.value)}
                                            onBlur={() => handleQuantityBlur(order.order_id)}
                                            disabled={isArchived}
                                            style={{ ...compactInputStyle, width: '5.5rem', minWidth: '5.5rem' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem' }}>
                                        {isArchived ? (
                                            <span style={{ ...statusStyle, display: 'inline-block', borderRadius: '999px', padding: '0.35rem 0.55rem', fontSize: '0.72rem' }}>
                                                Archivado
                                            </span>
                                        ) : (
                                            <select
                                                value={order.status}
                                                onChange={event => handleStatusChange(order.order_id, event.target.value)}
                                                style={{ ...controlStyle, ...statusStyle, minWidth: '8.5rem' }}
                                            >
                                                {STATUS_OPTIONS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                                            </select>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem' }}>
                                        <input
                                            value={order.supplier}
                                            maxLength={120}
                                            placeholder="Proveedor"
                                            onChange={event => handleTextChange(order.order_id, 'supplier', event.target.value)}
                                            onBlur={() => handleTextBlur(order.order_id, 'supplier')}
                                            disabled={isArchived}
                                            style={compactInputStyle}
                                        />
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem' }}>
                                        <input
                                            value={order.notes}
                                            maxLength={500}
                                            placeholder="Observación"
                                            onChange={event => handleTextChange(order.order_id, 'notes', event.target.value)}
                                            onBlur={() => handleTextBlur(order.order_id, 'notes')}
                                            disabled={isArchived}
                                            style={compactInputStyle}
                                        />
                                    </td>
                                    <td style={{ padding: '0.7rem 0.65rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {isArchived ? (
                                            <button type="button" onClick={() => handleRestore(order.order_id)} style={{ ...controlStyle, cursor: 'pointer', color: '#6ee7b7' }} title="Restaurar pedido">
                                                <RotateCcw size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmModal({
                                                    message: '¿Archivar este pedido? No se eliminará y podrás restaurarlo desde el historial.',
                                                    onConfirm: async () => {
                                                        setConfirmModal(null);
                                                        await handleArchive(order.order_id);
                                                    },
                                                })}
                                                style={{ ...controlStyle, cursor: 'pointer', color: '#fca5a5' }}
                                                title="Archivar pedido"
                                            >
                                                <Archive size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    onConfirm={confirmModal.action}
                    onCancel={() => setConfirmModal(null)}
                    danger={false}
                />
            )}
        </div>
    );
}
