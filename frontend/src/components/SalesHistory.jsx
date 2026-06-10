import React, { useState, useEffect } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { toast } from '../lib/toast';
import * as api from '../lib/api';

function SalesHistory() {
    const [sales, setSales] = useState([]);
    // Split date state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'QR_ONLY'
    const [loading, setLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
    const [editingInvoice, setEditingInvoice] = useState(null); // saleId being edited

    const fetchSales = async (forceAll = false) => {
        setLoading(true);
        try {
            const filters = forceAll ? {} : { startDate: startDate || undefined, endDate: endDate || undefined };
            const data = await api.getSales(filters);
            if (data.data) {
                let filteredSales = data.data;
                if (searchCode) {
                    const searchLower = searchCode.toLowerCase();
                    filteredSales = data.data.filter(sale =>
                        (sale.part_name && sale.part_name.toLowerCase().includes(searchLower)) ||
                        (sale.codigo && sale.codigo.toLowerCase().includes(searchLower)) ||
                        (sale.codigo_producto && sale.codigo_producto.toLowerCase().includes(searchLower)) ||
                        (sale.aplicacion && sale.aplicacion.toLowerCase().includes(searchLower))
                    );
                }
                setSales(filteredSales);
            }
        } catch (err) {
            console.error("Error fetching sales:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const handleInvoiceTypeChange = async (saleId, newType) => {
        try {
            await api.updateSaleInvoiceType(saleId, newType);
            toast.success('Tipo de venta actualizado');
            setEditingInvoice(null);
            fetchSales();
        } catch (err) {
            toast.error('Error: ' + err.message);
        }
    };

    const handleReturn = (saleId) => {
        setConfirmModal({
            message: '¿Seguro que deseas realizar la devolución de esta venta? El stock será restaurado.',
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    await api.returnSale(saleId);
                    toast.success('Devolución registrada exitosamente');
                    fetchSales();
                } catch (err) {
                    toast.error('Error: ' + err.message);
                }
            }
        });
    };

    const handleDelete = (saleId) => {
        setConfirmModal({
            message: '¿Seguro que deseas ELIMINAR esta venta? El registro será borrado permanentemente y el stock restaurado.',
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    await api.deleteSale(saleId);
                    toast.success('Venta eliminada correctamente');
                    fetchSales();
                } catch (err) {
                    toast.error('Error: ' + err.message);
                }
            }
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        // Si Supabase devuelve sin info de zona horaria, asumimos UTC
        const safe = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)
            ? dateStr
            : dateStr.replace(' ', 'T') + 'Z';
        return new Date(safe).toLocaleString();
    };

    const displayedSales = sales.filter(sale => {
        if (filterType === 'ALL') return true;
        if (filterType === 'QR') {
            return sale.invoice_type === 'FACTURA_QR' || sale.invoice_type === 'SIN_FACTURA_QR';
        }
        if (filterType === 'NORMAL') {
            return sale.invoice_type === 'FACTURA' || sale.invoice_type === 'SIN_FACTURA';
        }
        return true;
    });

    // Calculate total of displayed sales (excluding refunded)
    const totalSalesAmount = displayedSales.reduce((sum, sale) => {
        if (sale.refunded) return sum;
        return sum + (sale.total_price || 0);
    }, 0);

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchCode('');
        setFilterType('ALL');
        fetchSales(false);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Ventas del dia</h2>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '4px' }}>Desde</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ padding: '8px', colorScheme: 'dark' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '4px' }}>Hasta</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ padding: '8px', colorScheme: 'dark' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px', width: '200px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '4px' }}>Código</label>
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        placeholder="Buscar por código..."
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '160px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '4px' }}>Tipo de Venta</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={{ padding: '8px', colorScheme: 'dark', backgroundColor: '#1e293b', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                    >
                        <option value="ALL">Ventas Total</option>
                        <option value="NORMAL">Ventas</option>
                        <option value="QR">Ventas QR</option>
                    </select>
                </div>
                <button onClick={() => fetchSales()} className="primary" style={{ height: '35px', marginBottom: '1px' }}>
                    Filtrar
                </button>
                <button
                    onClick={clearFilters}
                    style={{ height: '35px', marginBottom: '1px', background: 'transparent', border: '1px solid #555', color: '#ccc' }}
                >
                    Hoy / Ver Todos
                </button>
            </div>

            {loading ? <p>Cargando...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                                <th style={{ padding: '8px' }}>Fecha</th>
                                <th style={{ padding: '8px' }}>Código Prod.</th>
                                <th style={{ padding: '8px' }}>Código</th>
                                <th style={{ padding: '8px' }}>Cantidad</th>
                                <th style={{ padding: '8px' }}>Precio Unit.</th>
                                <th style={{ padding: '8px' }}>Total</th>
                                <th style={{ padding: '8px' }}>Tipo de venta</th>
                                <th style={{ padding: '8px' }}>Estado</th>
                                <th style={{ padding: '8px' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedSales.map(sale => (
                                <tr key={sale.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '8px' }}>{formatDate(sale.sale_date)}</td>
                                    <td style={{ padding: '8px' }}>{sale.codigo_producto || '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.codigo || '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.quantity}</td>
                                    <td style={{ padding: '8px' }}>{sale.unit_price ? `Bs. ${sale.unit_price}` : '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.total_price ? `Bs. ${sale.total_price}` : '-'}</td>
                                    <td style={{ padding: '8px' }}>
                                        {editingInvoice === sale.id ? (
                                            <select
                                                autoFocus
                                                defaultValue={sale.invoice_type}
                                                onChange={(e) => handleInvoiceTypeChange(sale.id, e.target.value)}
                                                onBlur={() => setEditingInvoice(null)}
                                                style={{ padding: '4px', colorScheme: 'dark', backgroundColor: '#1e293b', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                                            >
                                                <option value="SIN_FACTURA">Sin Factura</option>
                                                <option value="SIN_FACTURA_QR">Sin Factura QR</option>
                                                <option value="FACTURA">Con Factura</option>
                                                <option value="FACTURA_QR">Con Factura QR</option>
                                            </select>
                                        ) : (
                                            <span
                                                onClick={() => !sale.refunded && setEditingInvoice(sale.id)}
                                                style={{ cursor: sale.refunded ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title={sale.refunded ? '' : 'Click para editar'}
                                            >
                                                {sale.invoice_type === 'FACTURA' ? 'Con Factura' :
                                                 sale.invoice_type === 'FACTURA_QR' ? 'Con Factura QR' :
                                                 sale.invoice_type === 'SIN_FACTURA_QR' ? 'Sin Factura QR' : 'Sin Factura'}
                                                {!sale.refunded && <span style={{ fontSize: '0.7rem', color: '#888' }}>✏️</span>}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        {sale.refunded ?
                                            <span style={{ color: 'red', fontWeight: 'bold' }}>Devuelto</span> :
                                            <span style={{ color: 'green' }}>Vendido</span>
                                        }
                                    </td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                                        {!sale.refunded && (
                                            <>
                                                <button
                                                    onClick={() => handleReturn(sale.id)}
                                                    style={{ backgroundColor: '#ff4444', fontSize: '0.8rem', padding: '4px 8px' }}
                                                >
                                                    Devolución
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(sale.id)}
                                                    style={{ backgroundColor: '#7f1d1d', fontSize: '0.8rem', padding: '4px 8px', border: '1px solid #ff4444' }}
                                                    title="Eliminar venta permanentemente"
                                                >
                                                    Eliminar
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderTop: '2px solid #34d399', fontWeight: 'bold' }}>
                                <td colSpan="5" style={{ padding: '12px', textAlign: 'right', color: '#059669' }}>TOTAL:</td>
                                <td style={{ padding: '12px', color: '#059669' }}>Bs. {totalSalesAmount.toFixed(2)}</td>
                                <td colSpan="3"></td>
                            </tr>

                            {displayedSales.length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ padding: '20px', textAlign: 'center' }}>No hay ventas registradas.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default SalesHistory;
