import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import './dashboard.css';

export default function Dashboard({ onAlertClick }) {
    const [allParts, setAllParts] = useState([]);
    const [threshold, setThreshold] = useState(10);
    const [chartData, setChartData] = useState([]);
    const [salesChart, setSalesChart] = useState([]);
    const [totalValue, setTotalValue] = useState(0);
    const [salesLoading, setSalesLoading] = useState(true);

    // Derived: lowStock recalculates whenever threshold or parts change
    const lowStock = allParts.filter(p => (p.stock ?? 0) < threshold);

    useEffect(() => {
        // Fetch parts
        fetch('/api/parts')
            .then(res => res.json())
            .then(payload => {
                const parts = payload.data || payload;
                setAllParts(parts);

                // Total inventory value - Sanitized to avoid NaN
                const value = parts.reduce((sum, p) => {
                    const price = parseFloat(p.cost_price) || 0;
                    const stock = parseInt(p.stock) || 0;
                    return sum + (price * stock);
                }, 0);
                setTotalValue(value);

                // Chart by family
                const groups = {};
                parts.forEach(p => {
                    const key = (p.familia || p.name || 'Otro').split(' ')[0];
                    groups[key] = (groups[key] || 0) + 1;
                });
                const chartArr = Object.entries(groups)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 7)
                    .map(([name, total]) => ({ name, total }));
                setChartData(chartArr);
            })
            .catch(() => {
                setAllParts([]);
                setChartData([]);
            });

        // Fetch sales for top products
        fetch('/api/sales')
            .then(res => res.json())
            .then(payload => {
                const sales = payload.data || payload;
                // Aggregate by product name
                const productSales = {};
                sales.forEach(s => {
                    const name = s.part_name || s.codigo_producto || `#${s.part_id}`;
                    if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 };
                    productSales[name].quantity += s.quantity ?? 0;
                    productSales[name].revenue += s.total_price ?? 0;
                });
                const topSales = Object.values(productSales)
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 8);
                setSalesChart(topSales);
                setSalesLoading(false);
            })
            .catch(() => {
                setSalesChart([]);
                setSalesLoading(false);
            });
    }, []);

    const handleExportOrder = (e) => {
        e.stopPropagation();
        const header = `NUEVO PEDIDO — Stock Crítico (< ${threshold} uds.)\n` + '='.repeat(50) + '\n\n';
        const lines = lowStock.map(p => [
            `Producto:   ${p.name || p.codigo_producto || ''}`,
            `Código:     ${p.codigo || ''}`,
            `Familia:    ${p.familia || ''}`,
            `Marca:      ${p.marca || ''}`,
            `MI/ME/ALT:  ${p.internal_measure ?? '-'} / ${p.external_measure ?? '-'} / ${p.height ?? '-'}`,
            `Aplicación: ${p.aplicacion || ''}`,
            `Stock act.: ${p.stock ?? 0} uds.`,
            '-'.repeat(40)
        ].join('\n')).join('\n');
        const blob = new Blob([header + lines], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nuevo_pedido.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return "0 Bs.";
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M Bs.`;
        if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K Bs.`;
        return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
    };

    return (
        <div>
            {/* Metric Cards */}
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Total Productos</div>
                    <div className="dashboard-card-value">{allParts.length.toLocaleString()}</div>
                    <div className="dashboard-card-sub">Registrados en DB</div>
                </div>

                {/* 1. VALOR TOTAL DEL INVENTARIO */}
                <div className="dashboard-card value-card">
                    <div className="dashboard-card-label">💰 Valor del Inventario</div>
                    <div className="dashboard-card-value value-highlight">{formatCurrency(totalValue)}</div>
                    <div className="dashboard-card-sub">Basado en Precio de Costo × Stock</div>
                </div>

                <div
                    className="dashboard-card alert-card clickable"
                    onClick={() => onAlertClick && onAlertClick()}
                >
                    <div className="dashboard-card-label">⚠ Stock Crítico</div>
                    <div className="dashboard-card-value danger">{lowStock.length}</div>
                    <div className="dashboard-card-footer">
                        <span className="dashboard-card-sub danger">Bajo {threshold} uds. — Click para ver</span>
                        <button className="btn-new-order" onClick={handleExportOrder}>
                            Nuevo Pedido
                        </button>
                    </div>
                </div>

                {/* Threshold control card */}
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Umbral Stock Crítico</div>
                    <div className="threshold-control">
                        <span className="threshold-label">Crítico si stock &lt;</span>
                        <input
                            type="number"
                            className="threshold-input"
                            value={threshold}
                            min={1}
                            max={9999}
                            onChange={e => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <span className="threshold-label">uds.</span>
                    </div>
                    <div className="dashboard-card-sub">{lowStock.length} productos afectados</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="dashboard-charts-row">
                {/* Stock by Family */}
                <div className="dashboard-chart-section">
                    <div className="dashboard-chart-title">📦 Stock por Familia</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }}
                            />
                            <Bar dataKey="total" name="Productos" radius={[4, 4, 0, 0]}>
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? '#38bdf8' : `rgba(56, 189, 248, ${0.65 - i * 0.08})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. TOP VENTAS */}
                <div className="dashboard-chart-section">
                    <div className="dashboard-chart-title">🏆 Top Productos Vendidos</div>
                    {salesLoading ? (
                        <div className="chart-loading">Cargando ventas...</div>
                    ) : salesChart.length === 0 ? (
                        <div className="chart-empty">Sin datos de ventas disponibles</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                data={salesChart}
                                layout="vertical"
                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                            >
                                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 10 }}
                                    width={110}
                                    tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val, name) => name === 'revenue' ? [`${val.toFixed(2)} Bs.`, 'Ingresos'] : [val, 'Unidades']}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <Bar dataKey="quantity" name="Unidades vendidas" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="revenue" name="Ingresos (Bs.)" fill="#818cf8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Low Stock Detailed Table */}
            <div className="dashboard-chart-section" style={{ marginTop: '1.5rem' }}>
                {lowStock.length > 0 ? (
                    <div className="dashboard-low-stock-list">
                        <h4>⚠ Productos en Stock Crítico (stock &lt; {threshold}) — {lowStock.length} ítem(s)</h4>
                        <div className="low-stock-table-wrapper">
                            <table className="low-stock-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Producto</th>
                                        <th>Familia</th>
                                        <th>Marca</th>
                                        <th>MI</th>
                                        <th>ME</th>
                                        <th>ALT</th>
                                        <th>PES</th>
                                        <th>Aplicación</th>
                                        <th>P. Costo</th>
                                        <th>Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStock.map((p, i) => (
                                        <tr key={i}>
                                            <td><code>{p.codigo || p.codigo_producto || '—'}</code></td>
                                            <td>{p.name || p.codigo_producto || '—'}</td>
                                            <td>{p.familia || '—'}</td>
                                            <td>{p.marca || '—'}</td>
                                            <td>{p.internal_measure ?? '—'}</td>
                                            <td>{p.external_measure ?? '—'}</td>
                                            <td>{p.height ?? '—'}</td>
                                            <td>{p.flange_measure ?? '—'}</td>
                                            <td className="td-aplicacion">{p.aplicacion || '—'}</td>
                                            <td>{p.cost_price ? `${p.cost_price}` : '—'}</td>
                                            <td><span className="low-stock-qty">{p.stock ?? 0}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="dashboard-export-bar">
                            <button className="btn-export" onClick={handleExportOrder}>
                                📋 Exportar como Nuevo Pedido
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="chart-empty">✅ No hay productos en stock crítico con el umbral actual ({threshold} uds.)</div>
                )}
            </div>
        </div>
    );
}
