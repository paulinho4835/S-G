import React, { useState, useEffect } from 'react';

function SalesHistory() {
    const [sales, setSales] = useState([]);
    // Split date state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchCode, setSearchCode] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchSales = (forceAll = false) => {
        setLoading(true);
        // Build URL
        let url = 'http://localhost:3005/api/sales';

        const params = new URLSearchParams();
        if (!forceAll) {
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    // Filter by code if searchCode is provided
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
            })
            .catch(err => console.error("Error fetching sales:", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const handleReturn = (saleId) => {
        if (!confirm('¿Seguro que deseas realizar la devolución de esta venta? El stock será restaurado.')) return;

        fetch(`http://localhost:3005/api/sales/${saleId}/return`, {
            method: 'POST'
        })
            .then(res => res.json())
            .then(data => {
                if (data.message === 'success') {
                    alert('Devolución exitosa');
                    fetchSales(); // Refresh list
                } else {
                    alert('Error: ' + data.error);
                }
            })
            .catch(err => alert('Error de conexión'));
    };

    // Calculate total of displayed sales (excluding refunded)
    const totalSalesAmount = sales.reduce((sum, sale) => {
        if (sale.refunded) return sum;
        return sum + (sale.total_price || 0);
    }, 0);

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSearchCode('');
        // We call fetchSales without arguments, so it defaults to today (no params)
        setLoading(true);
        fetch('http://localhost:3005/api/sales')
            .then(res => res.json())
            .then(data => {
                if (data.data) setSales(data.data);
            })
            .catch(err => console.error("Error fetching sales:", err))
            .finally(() => setLoading(false));
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Historial de Ventas</h2>
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
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '150px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', marginBottom: '4px' }}>Código</label>
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        placeholder="Buscar por código..."
                        style={{ width: '100%', padding: '8px' }}
                    />
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
                                <th style={{ padding: '8px' }}>Factura</th>
                                <th style={{ padding: '8px' }}>Estado</th>
                                <th style={{ padding: '8px' }}>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => (
                                <tr key={sale.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '8px' }}>{new Date(sale.sale_date).toLocaleString()}</td>
                                    <td style={{ padding: '8px' }}>{sale.codigo_producto || '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.codigo || '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.quantity}</td>
                                    <td style={{ padding: '8px' }}>{sale.unit_price ? `Bs. ${sale.unit_price}` : '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.total_price ? `Bs. ${sale.total_price}` : '-'}</td>
                                    <td style={{ padding: '8px' }}>{sale.invoice_type === 'FACTURA' ? 'Con Factura' : 'Sin Factura'}</td>
                                    <td style={{ padding: '8px' }}>
                                        {sale.refunded ?
                                            <span style={{ color: 'red', fontWeight: 'bold' }}>Devuelto</span> :
                                            <span style={{ color: 'green' }}>Vendido</span>
                                        }
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        {!sale.refunded && (
                                            <button
                                                onClick={() => handleReturn(sale.id)}
                                                style={{ backgroundColor: '#ff4444', fontSize: '0.8rem', padding: '4px 8px' }}
                                            >
                                                Devolución
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderTop: '2px solid #34d399', fontWeight: 'bold' }}>
                                <td colSpan="5" style={{ padding: '12px', textAlign: 'right', color: '#059669' }}>TOTAL:</td>
                                <td style={{ padding: '12px', color: '#059669' }}>Bs. {totalSalesAmount.toFixed(2)}</td>
                                <td colSpan="3"></td>
                            </tr>

                            {sales.length === 0 && (
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
