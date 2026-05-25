import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import './dashboard.css';

const PERIOD_LABELS = {
    today: 'Hoy',
    week:  'Esta Semana',
    month: 'Este Mes',
};

export default function Dashboard({ onAlertClick }) {
    const [allParts, setAllParts]         = useState([]);
    const [threshold, setThreshold]       = useState(5);
    const [chartData, setChartData]       = useState([]);
    const [salesChart, setSalesChart]     = useState([]);
    const [totalValue, setTotalValue]     = useState(0);
    const [salesLoading, setSalesLoading] = useState(true);

    // Sales summary state
    const [salesPeriod, setSalesPeriod]   = useState('today');
    const [salesSummary, setSalesSummary] = useState({ total_bs: 0, units_sold: 0, transactions: 0 });
    const [summaryLoading, setSummaryLoading] = useState(true);

    // Stock detail tab
    const [stockTab, setStockTab]         = useState('out'); // 'out' | 'low'

    // Derived stock groups
    const outOfStock = allParts.filter(p => (p.stock ?? 0) === 0);
    const lowStock   = allParts.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) < threshold);

    const fetchSummary = useCallback((period) => {
        setSummaryLoading(true);
        api.getSalesSummary(period)
            .then(d => { if (d.message === 'success') setSalesSummary(d.data); })
            .catch(() => {})
            .finally(() => setSummaryLoading(false));
    }, []);

    useEffect(() => {
        fetchSummary(salesPeriod);
    }, [salesPeriod, fetchSummary]);

    useEffect(() => {
        api.getParts()
            .then(payload => {
                const parts = payload.data || [];
                setAllParts(parts);
                const value = parts.reduce((sum, p) => sum + (parseFloat(p.cost_price) || 0) * (parseInt(p.stock) || 0), 0);
                setTotalValue(value);
                const groups = {};
                parts.forEach(p => {
                    const key = (p.familia || p.name || 'Otro').split(' ')[0];
                    groups[key] = (groups[key] || 0) + 1;
                });
                const chartArr = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, total]) => ({ name, total }));
                setChartData(chartArr);
            })
            .catch(() => { setAllParts([]); setChartData([]); });

        api.getSales({ startDate: '2000-01-01' })
            .then(payload => {
                const sales = payload.data || [];
                const productSales = {};
                sales.forEach(s => {
                    const name = s.part_name || s.codigo_producto || `#${s.part_id}`;
                    if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 };
                    productSales[name].quantity += s.quantity ?? 0;
                    productSales[name].revenue  += s.total_price ?? 0;
                });
                const topSales = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
                setSalesChart(topSales);
                setSalesLoading(false);
            })
            .catch(() => { setSalesChart([]); setSalesLoading(false); });
    }, []);

    const handleExportOrder = (e, list) => {
        e.stopPropagation();
        const header = `NUEVO PEDIDO — Stock Crítico (< ${threshold} uds.)\n` + '='.repeat(50) + '\n\n';
        const lines  = list.map(p => [
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
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'nuevo_pedido.txt'; a.click();
        URL.revokeObjectURL(url);
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '0 Bs.';
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M Bs.`;
        if (val >= 1_000)     return `${(val / 1_000).toFixed(2)}K Bs.`;
        return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
    };

    const tabBtn = (tab, label, color) => ({
        padding: '0.3rem 0.85rem',
        fontSize: '0.82rem',
        fontWeight: 600,
        borderRadius: '0.4rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.18s',
        background: salesPeriod === tab ? color : 'rgba(255,255,255,0.05)',
        color: salesPeriod === tab ? '#fff' : '#94a3b8',
    });

    const stockTabBtn = (tab, active) => ({
        padding: '0.45rem 1.1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        borderRadius: '0.5rem 0.5rem 0 0',
        border: 'none',
        cursor: 'pointer',
        background: stockTab === tab ? '#1e293b' : 'transparent',
        color: stockTab === tab ? (tab === 'out' ? '#ef4444' : '#f97316') : '#64748b',
        borderBottom: stockTab === tab
            ? `2px solid ${tab === 'out' ? '#ef4444' : '#f97316'}`
            : '2px solid transparent',
        transition: 'all 0.18s',
    });

    const activeStockList = stockTab === 'out' ? outOfStock : lowStock;

    return (
        <div>
            {/* ── Metric Cards Row ── */}
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Total Productos</div>
                    <div className="dashboard-card-value">{allParts.length.toLocaleString()}</div>
                    <div className="dashboard-card-sub">Registrados en DB</div>
                </div>

                <div className="dashboard-card value-card">
                    <div className="dashboard-card-label">💰 Valor del Inventario</div>
                    <div className="dashboard-card-value value-highlight">{formatCurrency(totalValue)}</div>
                    <div className="dashboard-card-sub">Basado en Precio de Costo × Stock</div>
                </div>

                {/* 🔴 Sin Stock */}
                <div
                    className="dashboard-card"
                    style={{ borderColor: 'rgba(239,68,68,0.3)', cursor: 'pointer' }}
                    onClick={() => { setStockTab('out'); onAlertClick && onAlertClick(); }}
                >
                    <div className="dashboard-card-label" style={{ color: '#ef4444' }}>🔴 Sin Stock</div>
                    <div className="dashboard-card-value" style={{ color: '#ef4444' }}>{outOfStock.length.toLocaleString()}</div>
                    <div className="dashboard-card-sub">Productos con 0 unidades — Click para ver</div>
                </div>

                {/* 🟡 Bajo Stock */}
                <div
                    className="dashboard-card alert-card clickable"
                    onClick={() => { setStockTab('low'); onAlertClick && onAlertClick(); }}
                >
                    <div className="dashboard-card-label">🟡 Bajo Stock</div>
                    <div className="dashboard-card-value" style={{ color: '#f97316' }}>{lowStock.length.toLocaleString()}</div>
                    <div className="dashboard-card-footer">
                        <span className="dashboard-card-sub">Entre 1 y {threshold - 1} uds. — Click para ver</span>
                        <button className="btn-new-order" onClick={e => handleExportOrder(e, lowStock)}>
                            Nuevo Pedido
                        </button>
                    </div>
                </div>

                {/* Threshold control */}
                <div className="dashboard-card">
                    <div className="dashboard-card-label">Umbral Stock Crítico</div>
                    <div className="threshold-control">
                        <span className="threshold-label">Crítico si stock &lt;</span>
                        <input
                            type="number"
                            className="threshold-input"
                            value={threshold}
                            min={1} max={9999}
                            onChange={e => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <span className="threshold-label">uds.</span>
                    </div>
                    <div className="dashboard-card-sub">
                        {outOfStock.length} sin stock · {lowStock.length} bajo stock
                    </div>
                </div>
            </div>

            {/* ── Sales Summary Panel ── */}
            <div className="dashboard-chart-section" style={{ marginTop: '1.5rem', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div className="dashboard-chart-title" style={{ marginBottom: 0 }}>📈 Resumen de Ventas</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {['today', 'week', 'month'].map(p => (
                            <button key={p} style={tabBtn(p, PERIOD_LABELS[p], '#3b82f6')} onClick={() => setSalesPeriod(p)}>
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>
                </div>

                {summaryLoading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>Cargando...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'Ingresos Totales', value: formatCurrency(salesSummary.total_bs), color: '#22c55e', icon: '💰' },
                            { label: 'Unidades Vendidas', value: `${salesSummary.units_sold} uds.`, color: '#38bdf8', icon: '📦' },
                            { label: 'Transacciones', value: salesSummary.transactions, color: '#a78bfa', icon: '🧾' },
                        ].map(({ label, value, color, icon }) => (
                            <div key={label} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid #334155',
                                borderRadius: '0.75rem',
                                padding: '1rem 1.25rem',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{icon}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Charts Row ── */}
            <div className="dashboard-charts-row">
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
                                    <Cell key={i} fill={i === 0 ? '#38bdf8' : `rgba(56,189,248,${0.65 - i * 0.08})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="dashboard-chart-section">
                    <div className="dashboard-chart-title">🏆 Top Productos Vendidos</div>
                    {salesLoading ? (
                        <div className="chart-loading">Cargando ventas...</div>
                    ) : salesChart.length === 0 ? (
                        <div className="chart-empty">Sin datos de ventas disponibles</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={salesChart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} width={110}
                                    tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val, name) => name === 'revenue' ? [`${val.toFixed(2)} Bs.`, 'Ingresos'] : [val, 'Unidades']}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <Bar dataKey="quantity" name="Unidades vendidas" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="revenue"  name="Ingresos (Bs.)"   fill="#818cf8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Stock Detail Table with Tabs ── */}
            <div className="dashboard-chart-section" style={{ marginTop: '1.5rem' }}>
                {/* Tab header */}
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #334155', marginBottom: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 1rem 0' }}>
                    <button style={stockTabBtn('out')} onClick={() => setStockTab('out')}>
                        🔴 Sin Stock
                        <span style={{
                            marginLeft: '6px', background: stockTab === 'out' ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)',
                            color: stockTab === 'out' ? '#ef4444' : '#64748b',
                            borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                            padding: '1px 7px'
                        }}>{outOfStock.length}</span>
                    </button>
                    <button style={stockTabBtn('low')} onClick={() => setStockTab('low')}>
                        🟡 Bajo Stock (&lt; {threshold} uds.)
                        <span style={{
                            marginLeft: '6px', background: stockTab === 'low' ? 'rgba(249,115,22,0.2)' : 'rgba(100,116,139,0.2)',
                            color: stockTab === 'low' ? '#f97316' : '#64748b',
                            borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                            padding: '1px 7px'
                        }}>{lowStock.length}</span>
                    </button>
                </div>

                {activeStockList.length > 0 ? (
                    <div className="dashboard-low-stock-list">
                        <h4 style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
                            {stockTab === 'out' ? '🔴 Productos Sin Stock (0 unidades)' : `🟡 Productos Bajo Stock (1–${threshold - 1} uds.)`}
                            {' '}— {activeStockList.length} ítem(s)
                        </h4>
                        <div className="low-stock-table-wrapper">
                            <table className="low-stock-table">
                                <thead>
                                    <tr>
                                        <th>Código</th><th>Producto</th><th>Familia</th><th>Marca</th>
                                        <th>MI</th><th>ME</th><th>ALT</th><th>PES</th>
                                        <th>Aplicación</th><th>P. Costo</th><th>Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStockList.map((p, i) => (
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
                                            <td>
                                                <span className="low-stock-qty" style={{
                                                    color: (p.stock ?? 0) === 0 ? '#ef4444' : '#f97316'
                                                }}>{p.stock ?? 0}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="dashboard-export-bar">
                            <button className="btn-export" onClick={e => handleExportOrder(e, activeStockList)}>
                                📋 Exportar como Nuevo Pedido
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="chart-empty" style={{ padding: '2rem' }}>
                        {stockTab === 'out'
                            ? '✅ No hay productos sin stock.'
                            : `✅ No hay productos con bajo stock (< ${threshold} uds.).`}
                    </div>
                )}
            </div>
        </div>
    );
}
