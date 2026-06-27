import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '../lib/api';
import {
    ComposedChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
    Area, Line, CartesianGrid, ReferenceLine
} from 'recharts';
import {
    groupByDay, groupByWeek, groupByMonth, groupByYear, groupByCode, groupByHour,
    calcTrend, calcMargin, getPresetRange, formatCurrency
} from '../lib/salesUtils';
import {
    TrendingUp, TrendingDown, DollarSign, Package, FileText, Download,
    AlertCircle, AlertTriangle, Archive, CheckCircle2, Calendar,
    Clock, Award, Tag, BarChart2
} from 'lucide-react';
import { SkeletonBar, SkeletonChart } from './Skeleton';
import './dashboard.css';

const PERIOD_LABELS = { today: 'Hoy', week: 'Esta Semana', month: 'Este Mes' };

const PRESETS = [
    { key: 'today',   label: 'Hoy' },
    { key: 'week',    label: 'Semana' },
    { key: 'month',   label: 'Mes' },
    { key: 'quarter', label: 'Trimestre' },
    { key: 'year',    label: 'Año' },
];

const TOOLTIP_STYLE = {
    contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' },
    cursor: { fill: 'rgba(56,189,248,0.06)' }
};

const TAB_COLOR = { out: '#ef4444', low: '#f97316', dead: '#6b7280' };

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard({ onAlertClick }) {
    const [allParts, setAllParts]         = useState([]);
    const [threshold, setThreshold]       = useState(5);
    const [chartData, setChartData]       = useState([]);
    const [totalValue, setTotalValue]     = useState(0);

    // Sales summary (hoy/semana/mes panel)
    const [salesPeriod, setSalesPeriod]   = useState('today');
    const [salesSummary, setSalesSummary] = useState({ total_bs: 0, units_sold: 0, transactions: 0 });
    const [summaryLoading, setSummaryLoading] = useState(true);

    // Stock tabs
    const [stockTab, setStockTab]         = useState('out');

    // Analytics filter state
    const [preset, setPreset]             = useState('month');
    const [customStart, setCustomStart]   = useState('');
    const [customEnd, setCustomEnd]       = useState('');
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [rawSales, setRawSales]         = useState([]);
    const [prevRawSales, setPrevRawSales] = useState([]);

    // Trend grouping
    const [trendGroup, setTrendGroup]     = useState('auto');

    // Stock muerto
    const [deadStock, setDeadStock]       = useState([]);
    const [deadStockLoading, setDeadStockLoading] = useState(false);

    // Derived stock groups
    const outOfStock = allParts.filter(p => (p.stock ?? 0) === 0);
    const lowStock   = allParts.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) < threshold);

    // ── Computed from rawSales ────────────────────────────────────────────────
    const daysBetween = useMemo(() => {
        const { startDate, endDate } = preset === 'custom'
            ? { startDate: customStart, endDate: customEnd }
            : getPresetRange(preset);
        if (!startDate || !endDate) return 0;
        return Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
    }, [preset, customStart, customEnd]);

    const trendData = useMemo(() => {
        if (trendGroup === 'day')   return groupByDay(rawSales);
        if (trendGroup === 'week')  return groupByWeek(rawSales);
        if (trendGroup === 'month') return groupByMonth(rawSales);
        if (trendGroup === 'year')  return groupByYear(rawSales);
        // auto: escala según rango
        if (daysBetween <= 60)  return groupByDay(rawSales);
        if (daysBetween <= 365) return groupByWeek(rawSales);
        return groupByMonth(rawSales);
    }, [rawSales, daysBetween, trendGroup]);

    const byCodeData    = useMemo(() => groupByCode(rawSales), [rawSales]);
    const hourData      = useMemo(() => groupByHour(rawSales), [rawSales]);
    const trendPct      = useMemo(() => calcTrend(trendData), [trendData]);
    const marginData    = useMemo(() => calcMargin(rawSales), [rawSales]);

    const analyticsTotals = useMemo(() => ({
        total:        rawSales.reduce((s, r) => s + parseFloat(r.total_price || 0), 0),
        units:        rawSales.reduce((s, r) => s + parseInt(r.quantity || 0), 0),
        transactions: rawSales.length,
    }), [rawSales]);

    const prevTotals = useMemo(() => ({
        total:        prevRawSales.reduce((s, r) => s + parseFloat(r.total_price || 0), 0),
        units:        prevRawSales.reduce((s, r) => s + parseInt(r.quantity || 0), 0),
        transactions: prevRawSales.length,
    }), [prevRawSales]);

    const ticketPromedio = useMemo(() =>
        analyticsTotals.transactions > 0 ? analyticsTotals.total / analyticsTotals.transactions : 0,
    [analyticsTotals]);

    const vsPrev = useMemo(() => {
        if (prevTotals.total === 0) return null;
        return ((analyticsTotals.total - prevTotals.total) / prevTotals.total) * 100;
    }, [analyticsTotals.total, prevTotals.total]);

    // ── Data fetching ─────────────────────────────────────────────────────────
    const fetchSummary = useCallback((period) => {
        setSummaryLoading(true);
        api.getSalesSummary(period)
            .then(d => { if (d.message === 'success') setSalesSummary(d.data); })
            .catch(() => {})
            .finally(() => setSummaryLoading(false));
    }, []);

    const fetchAnalytics = useCallback(() => {
        const range = preset === 'custom'
            ? { startDate: customStart, endDate: customEnd }
            : getPresetRange(preset);
        if (!range.startDate || !range.endDate) return;
        setAnalyticsLoading(true);
        api.getSales(range)
            .then(d => { setRawSales(d.data || []); })
            .catch(() => { setRawSales([]); })
            .finally(() => setAnalyticsLoading(false));

        // Fetch previous period for comparison (parallel, no loader)
        const start   = new Date(range.startDate + 'T12:00:00');
        const end     = new Date(range.endDate + 'T12:00:00');
        const diffMs  = end - start;
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - diffMs);
        api.getSales({
            startDate: prevStart.toLocaleDateString('en-CA'),
            endDate:   prevEnd.toLocaleDateString('en-CA'),
        })
            .then(d => setPrevRawSales(d.data || []))
            .catch(() => setPrevRawSales([]));
    }, [preset, customStart, customEnd]);

    useEffect(() => { fetchSummary(salesPeriod); }, [salesPeriod, fetchSummary]);

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
                setChartData(Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, total]) => ({ name, total })));
            })
            .catch(() => { setAllParts([]); setChartData([]); });
    }, []);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    useEffect(() => {
        setDeadStockLoading(true);
        api.getDeadStock(90)
            .then(d => setDeadStock(d.data || []))
            .catch(() => setDeadStock([]))
            .finally(() => setDeadStockLoading(false));
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────
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

    const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const formatTrendLabel = (str) => {
        if (!str) return '';
        if (str.length === 4) return str; // año: "2024"
        if (str.length === 7) {           // mes: "2024-01"
            const [y, m] = str.split('-');
            return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
        }
        const [, m, d] = str.split('-');  // día/semana: "2024-01-15"
        return `${d}/${m}`;
    };

    const tabBtn = (tab, color) => ({
        padding: '0.3rem 0.85rem', fontSize: '0.82rem', fontWeight: 600,
        borderRadius: '0.4rem', border: 'none', cursor: 'pointer', transition: 'all 0.18s',
        background: salesPeriod === tab ? color : 'rgba(255,255,255,0.05)',
        color: salesPeriod === tab ? '#fff' : '#94a3b8',
    });

    const stockTabBtn = (tab) => ({
        padding: '0.45rem 1.1rem', fontSize: '0.85rem', fontWeight: 600,
        borderRadius: '0.5rem 0.5rem 0 0', border: 'none', cursor: 'pointer',
        background: stockTab === tab ? '#1e293b' : 'transparent',
        color: stockTab === tab ? TAB_COLOR[tab] : '#64748b',
        borderBottom: stockTab === tab ? `2px solid ${TAB_COLOR[tab]}` : '2px solid transparent',
        transition: 'all 0.18s',
    });

    const presetBtn = (key) => ({
        padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontWeight: 600,
        borderRadius: '0.4rem', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        background: preset === key ? '#6366f1' : 'rgba(255,255,255,0.05)',
        color: preset === key ? '#fff' : '#94a3b8',
    });

    const activeStockList = stockTab === 'out' ? outOfStock : stockTab === 'low' ? lowStock : deadStock;

    // Trend arrow + color
    const trendArrow = trendPct === null ? null : trendPct >= 0 ? '↑' : '↓';
    const trendColor = trendPct === null ? '#94a3b8' : trendPct >= 0 ? '#22c55e' : '#ef4444';

    return (
        <div>

            {/* ══════════════════════════════════════════════════════════════
                1. VENTAS — Lo primero que el negocio necesita saber cada día
            ══════════════════════════════════════════════════════════════ */}
            <div className="dashboard-chart-section" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid #22c55e' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div className="dashboard-chart-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} color="#22c55e" /> Resumen de Ventas</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {['today', 'week', 'month'].map(p => (
                            <button key={p} style={tabBtn(p, '#3b82f6')} onClick={() => setSalesPeriod(p)}>
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>
                </div>
                {summaryLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <SkeletonBar height={12} width="55%" />
                                <SkeletonBar height={26} width="80%" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        {[
                            { label: 'Ingresos Totales',  value: formatCurrency(salesSummary.total_bs), color: '#22c55e', rgb: '34,197,94',   Icon: DollarSign },
                            { label: 'Unidades Vendidas', value: `${salesSummary.units_sold} uds.`,     color: '#3590d0', rgb: '53,144,208',  Icon: Package },
                            { label: 'Transacciones',     value: salesSummary.transactions,             color: '#a78bfa', rgb: '167,139,250', Icon: FileText },
                        ].map(({ label, value, color, rgb, Icon }) => (
                            <div key={label} style={{ background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.3)`, borderRadius: '0.75rem', padding: '1rem 1.25rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.35rem' }}>
                                    <Icon size={24} color={color} strokeWidth={1.5} />
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                2. STOCK — Alertas accionables + tabla de detalle
            ══════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                <div className="dashboard-card" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.45)', cursor: 'pointer', margin: 0 }}
                    onClick={() => { setStockTab('out'); onAlertClick && onAlertClick(); }}>
                    <div className="dashboard-card-label" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={14} /> Sin Stock</div>
                    <div className="dashboard-card-value" style={{ color: '#ef4444' }}>{outOfStock.length.toLocaleString()}</div>
                    <div className="dashboard-card-sub">Productos con 0 unidades — Click para ver</div>
                </div>

                <div className="dashboard-card clickable" style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.45)', margin: 0 }}
                    onClick={() => { setStockTab('low'); onAlertClick && onAlertClick(); }}>
                    <div className="dashboard-card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} color="#f97316" /> Bajo Stock</div>
                    <div className="dashboard-card-value" style={{ color: '#f97316' }}>{lowStock.length.toLocaleString()}</div>
                    <div className="dashboard-card-footer">
                        <span className="dashboard-card-sub">Entre 1 y {threshold - 1} uds.</span>
                        <button className="btn-new-order" onClick={e => handleExportOrder(e, lowStock)}>Nuevo Pedido</button>
                    </div>
                </div>

                <div className="dashboard-card" style={{ background: 'rgba(107,114,128,0.08)', borderColor: 'rgba(107,114,128,0.45)', margin: 0, cursor: 'pointer' }}
                    onClick={() => { setStockTab('dead'); onAlertClick && onAlertClick(); }}>
                    <div className="dashboard-card-label" style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}><Archive size={14} /> Stock Muerto</div>
                    <div className="dashboard-card-value" style={{ color: '#6b7280' }}>
                        {deadStockLoading ? '…' : deadStock.length.toLocaleString()}
                    </div>
                    <div className="dashboard-card-sub">Sin ventas en 90 días — Click para ver</div>
                </div>

                <div className="dashboard-card" style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.35)', margin: 0 }}>
                    <div className="dashboard-card-label">Umbral Stock Crítico</div>
                    <div className="threshold-control">
                        <span className="threshold-label">Crítico si stock &lt;</span>
                        <input type="number" className="threshold-input" value={threshold} min={1} max={9999}
                            onChange={e => setThreshold(Math.max(1, parseInt(e.target.value) || 1))} />
                        <span className="threshold-label">uds.</span>
                    </div>
                    <div className="dashboard-card-sub">{outOfStock.length} sin stock · {lowStock.length} bajo stock</div>
                </div>
            </div>

            {/* ── Tabla de detalle de stock ── */}
            <div className="dashboard-chart-section" style={{ marginTop: '1rem', borderTop: '3px solid #f97316' }}>
                <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #334155', marginBottom: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 1rem 0', flexWrap: 'wrap' }}>
                    <button style={stockTabBtn('out')} onClick={() => setStockTab('out')}>
                        <AlertCircle size={13} style={{ marginRight: '4px' }} /> Sin Stock
                        <span style={{ marginLeft: '6px', background: stockTab === 'out' ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)', color: stockTab === 'out' ? '#ef4444' : '#64748b', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px' }}>{outOfStock.length}</span>
                    </button>
                    <button style={stockTabBtn('low')} onClick={() => setStockTab('low')}>
                        <AlertTriangle size={13} style={{ marginRight: '4px' }} /> Bajo Stock (&lt; {threshold} uds.)
                        <span style={{ marginLeft: '6px', background: stockTab === 'low' ? 'rgba(249,115,22,0.2)' : 'rgba(100,116,139,0.2)', color: stockTab === 'low' ? '#f97316' : '#64748b', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px' }}>{lowStock.length}</span>
                    </button>
                    <button style={stockTabBtn('dead')} onClick={() => setStockTab('dead')}>
                        <Archive size={13} style={{ marginRight: '4px' }} /> Stock Muerto (90d)
                        <span style={{ marginLeft: '6px', background: stockTab === 'dead' ? 'rgba(107,114,128,0.2)' : 'rgba(100,116,139,0.2)', color: stockTab === 'dead' ? '#6b7280' : '#64748b', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px' }}>
                            {deadStockLoading ? '…' : deadStock.length}
                        </span>
                    </button>
                </div>

                {stockTab === 'dead' && deadStockLoading ? (
                    <div className="chart-empty" style={{ padding: '2rem' }}>Calculando stock muerto...</div>
                ) : activeStockList.length > 0 ? (
                    <div className="dashboard-low-stock-list">
                        <h4 style={{ padding: '0 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {stockTab === 'out'  && <><AlertCircle size={14} color="#ef4444" /> Productos Sin Stock (0 unidades)</>}
                            {stockTab === 'low'  && <><AlertTriangle size={14} color="#f97316" /> Productos Bajo Stock (1–{threshold - 1} uds.)</>}
                            {stockTab === 'dead' && <><Archive size={14} color="#6b7280" /> Stock Muerto — sin ventas en 90 días</>}
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>— {activeStockList.length} ítem(s)</span>
                        </h4>
                        <div className="low-stock-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                                            <td><span className="low-stock-qty" style={{ color: (p.stock ?? 0) === 0 ? '#ef4444' : stockTab === 'dead' ? '#6b7280' : '#f97316' }}>{p.stock ?? 0}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {stockTab !== 'dead' && (
                            <div className="dashboard-export-bar">
                                <button className="btn-export" onClick={e => handleExportOrder(e, activeStockList)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Download size={14} /> Exportar como Nuevo Pedido
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="chart-empty" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <CheckCircle2 size={16} color="#22c55e" />
                        {stockTab === 'out'  && 'No hay productos sin stock.'}
                        {stockTab === 'low'  && `No hay productos con bajo stock (< ${threshold} uds.).`}
                        {stockTab === 'dead' && 'No hay stock muerto — todos los productos con stock han tenido movimiento en los últimos 90 días.'}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                3. ANALYTICS — Análisis por período con filtros
            ══════════════════════════════════════════════════════════════ */}
            <div className="dashboard-chart-section" style={{ marginTop: '1.5rem', padding: '1.25rem 1.5rem', borderTop: '3px solid #6366f1' }}>

                {/* ── Filter bar ── */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={13} /> Período:</span>
                    {PRESETS.map(({ key, label }) => (
                        <button key={key} style={presetBtn(key)} onClick={() => setPreset(key)}>{label}</button>
                    ))}
                    <button style={presetBtn('custom')} onClick={() => setPreset('custom')}>Personalizado</button>

                    {preset === 'custom' && (
                        <>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} />
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>→</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} />
                        </>
                    )}

                    {analyticsLoading && (
                        <SkeletonBar height={12} width={70} style={{ display: 'inline-block', marginLeft: '0.5rem', verticalAlign: 'middle' }} />
                    )}
                </div>

                {/* ── KPI row 1: métricas principales ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {[
                        { label: 'Ingresos',      value: formatCurrency(analyticsTotals.total), color: '#22c55e', rgb: '34,197,94' },
                        { label: 'Unidades',      value: analyticsTotals.units,                color: '#38bdf8', rgb: '56,189,248' },
                        { label: 'Transacciones', value: analyticsTotals.transactions,         color: '#a78bfa', rgb: '167,139,250' },
                        {
                            label: 'Tendencia',
                            value: trendArrow === null ? 'Sin datos' : `${trendArrow} ${Math.abs(trendPct).toFixed(1)}%`,
                            color: trendColor,
                            rgb: trendPct === null ? '148,163,184' : trendPct >= 0 ? '34,197,94' : '239,68,68',
                            sub: trendPct !== null ? 'vs. primera mitad del período' : '',
                        },
                    ].map(({ label, value, color, rgb, sub }) => (
                        <div key={label} style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.25)`, borderRadius: '0.6rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>{label}</div>
                            {sub && <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.1rem' }}>{sub}</div>}
                        </div>
                    ))}
                </div>

                {/* ── KPI row 2: métricas derivadas ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {[
                        {
                            label: 'Ticket Promedio',
                            value: formatCurrency(ticketPromedio),
                            color: '#f59e0b',
                            rgb: '245,158,11',
                            sub: 'por transacción',
                        },
                        {
                            label: 'Margen Bruto',
                            value: marginData ? `${marginData.marginPct.toFixed(1)}%` : '—',
                            color: marginData && marginData.marginPct >= 0 ? '#22c55e' : '#ef4444',
                            rgb: marginData && marginData.marginPct >= 0 ? '34,197,94' : '239,68,68',
                            sub: marginData ? formatCurrency(marginData.margin) : 'sin datos de costo',
                        },
                        {
                            label: 'vs. Período Anterior',
                            value: vsPrev === null ? 'Sin datos' : `${vsPrev >= 0 ? '↑' : '↓'} ${Math.abs(vsPrev).toFixed(1)}%`,
                            color: vsPrev === null ? '#94a3b8' : vsPrev >= 0 ? '#22c55e' : '#ef4444',
                            rgb: vsPrev === null ? '148,163,184' : vsPrev >= 0 ? '34,197,94' : '239,68,68',
                            sub: prevTotals.total > 0 ? `anterior: ${formatCurrency(prevTotals.total)}` : '',
                        },
                    ].map(({ label, value, color, rgb, sub }) => (
                        <div key={label} style={{ background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.25)`, borderRadius: '0.6rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>{label}</div>
                            {sub && <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.1rem' }}>{sub}</div>}
                        </div>
                    ))}
                </div>

                {/* ── Trend line chart ── */}
                <div style={{ marginBottom: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div className="dashboard-chart-title" style={{ marginBottom: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={15} color="#22c55e" /> Tendencia de Ventas (Bs.)
                            {trendArrow && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: trendColor, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    {trendPct >= 0
                                        ? <TrendingUp size={13} />
                                        : <TrendingDown size={13} />
                                    }
                                    {Math.abs(trendPct).toFixed(1)}%
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {[
                                { key: 'auto',  label: 'Auto' },
                                { key: 'day',   label: 'Día' },
                                { key: 'week',  label: 'Semana' },
                                { key: 'month', label: 'Mes' },
                                { key: 'year',  label: 'Año' },
                            ].map(({ key, label }) => (
                                <button key={key} onClick={() => setTrendGroup(key)} style={{
                                    padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600,
                                    borderRadius: '0.3rem', border: 'none', cursor: 'pointer',
                                    background: trendGroup === key ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                    color: trendGroup === key ? '#fff' : '#94a3b8',
                                    transition: 'all 0.15s',
                                }}>{label}</button>
                            ))}
                        </div>
                    </div>

                    {analyticsLoading ? (
                        <SkeletonChart height={230} />
                    ) : trendData.length === 0 ? (
                        <div className="chart-empty">Sin ventas en el período seleccionado</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={230}>
                            <ComposedChart data={trendData} margin={{ top: 10, right: 48, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 10 }} tickFormatter={formatTrendLabel} />
                                <YAxis yAxisId="bs" stroke="#22c55e" tick={{ fontSize: 10 }}
                                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                                <YAxis yAxisId="tx" orientation="right" stroke="#6366f1" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(v, name) =>
                                        name === 'Ingresos (Bs.)'   ? [`${parseFloat(v).toFixed(2)} Bs.`, name] :
                                        name === 'Transacciones' ? [v, name] : [v, name]
                                    }
                                    labelFormatter={l => `Período: ${formatTrendLabel(l)}`}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <ReferenceLine
                                    yAxisId="bs"
                                    y={trendData.reduce((s, d) => s + d.total, 0) / (trendData.length || 1)}
                                    stroke="#f59e0b" strokeDasharray="5 3"
                                    label={{ value: 'Prom.', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
                                />
                                <Bar yAxisId="tx" dataKey="transactions" name="Transacciones"
                                    fill="rgba(99,102,241,0.3)" radius={[3, 3, 0, 0]} />
                                <Area yAxisId="bs" type="monotone" dataKey="total" name="Ingresos (Bs.)"
                                    stroke="#22c55e" strokeWidth={2.5}
                                    fill="url(#gradRevenue)"
                                    dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                                    activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* ── Ventas por código de producto ── */}
                <div style={{ marginBottom: '1.75rem' }}>
                    <div className="dashboard-chart-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={15} color="#818cf8" /> Ventas por Código de Producto
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.25rem' }}>
                            Top {Math.min(byCodeData.length, 12)} productos
                        </span>
                    </div>

                    {analyticsLoading ? (
                        <SkeletonChart height={230} />
                    ) : byCodeData.length === 0 ? (
                        <div className="chart-empty">Sin ventas en el período seleccionado</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(200, byCodeData.length * 38)}>
                            <ComposedChart data={byCodeData} layout="vertical" margin={{ top: 5, right: 70, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradQty" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={true} horizontal={false} />
                                <XAxis type="number" xAxisId="qty" stroke="#38bdf8" tick={{ fontSize: 10 }}
                                    label={{ value: 'Uds.', position: 'insideRight', offset: -4, fontSize: 10, fill: '#38bdf8' }} />
                                <XAxis type="number" xAxisId="rev" orientation="top" stroke="#818cf8" tick={{ fontSize: 10 }}
                                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}
                                    label={{ value: 'Bs.', position: 'insideRight', offset: -4, fontSize: 10, fill: '#818cf8' }} />
                                <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} width={120}
                                    tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(val, name) =>
                                        name === 'Ingresos (Bs.)' ? [`${parseFloat(val).toFixed(2)} Bs.`, name] : [val, name]
                                    }
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <ReferenceLine
                                    xAxisId="qty"
                                    x={byCodeData.reduce((s, d) => s + d.quantity, 0) / (byCodeData.length || 1)}
                                    stroke="#f59e0b" strokeDasharray="5 3"
                                    label={{ value: 'Prom.', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
                                />
                                <Bar xAxisId="qty" dataKey="quantity" name="Unidades vendidas"
                                    fill="url(#gradQty)" radius={[0, 4, 4, 0]} />
                                <Line xAxisId="rev" type="monotone" dataKey="revenue" name="Ingresos (Bs.)"
                                    stroke="#818cf8" strokeWidth={0}
                                    dot={{ r: 5, fill: '#818cf8', strokeWidth: 2, stroke: '#1e293b' }}
                                    activeDot={{ r: 7 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* ── Hora pico de ventas ── */}
                <div>
                    <div className="dashboard-chart-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={15} color="#f59e0b" /> Hora Pico de Ventas
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.25rem' }}>
                            distribución por hora del día
                        </span>
                    </div>

                    {analyticsLoading ? (
                        <SkeletonChart height={230} />
                    ) : hourData.length === 0 ? (
                        <div className="chart-empty">Sin ventas en el período seleccionado</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={hourData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="hour" stroke="#475569" tick={{ fontSize: 10 }} />
                                <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                    formatter={(v, name) =>
                                        name === 'total' ? [`${v.toFixed(2)} Bs.`, 'Ingresos'] :
                                        name === 'units' ? [v, 'Unidades'] : [v, 'Transacciones']
                                    }
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <Bar dataKey="total" name="Ingresos (Bs.)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="transactions" name="Transacciones" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                4. INVENTARIO — Visión general (referencia, no urgente)
            ══════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <div className="dashboard-card" style={{ margin: 0 }}>
                    <div className="dashboard-card-label">Total Productos</div>
                    <div className="dashboard-card-value">{allParts.length.toLocaleString()}</div>
                    <div className="dashboard-card-sub">Registrados en DB</div>
                </div>
                <div className="dashboard-card value-card" style={{ margin: 0 }}>
                    <div className="dashboard-card-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><DollarSign size={13} color="var(--accent-color)" /> Valor del Inventario</div>
                    <div className="dashboard-card-value value-highlight">{formatCurrency(totalValue)}</div>
                    <div className="dashboard-card-sub">Precio de Costo × Stock</div>
                </div>
            </div>

            <div className="dashboard-charts-row" style={{ marginTop: '1rem' }}>
                <div className="dashboard-chart-section" style={{ borderTop: '3px solid #38bdf8' }}>
                    <div className="dashboard-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart2 size={15} color="#3590d0" /> Stock por Familia</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <Tooltip {...TOOLTIP_STYLE} />
                            <Bar dataKey="total" name="Productos" radius={[4, 4, 0, 0]}>
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? '#38bdf8' : `rgba(56,189,248,${0.65 - i * 0.08})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="dashboard-chart-section" style={{ borderTop: '3px solid #818cf8' }}>
                    <div className="dashboard-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Award size={15} color="#818cf8" /> Top Histórico Vendidos <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>(todo el tiempo)</span></div>
                    {byCodeData.length === 0 ? (
                        <div className="chart-empty">Sin datos de ventas disponibles</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={byCodeData.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} width={110}
                                    tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                                <Tooltip {...TOOLTIP_STYLE}
                                    formatter={(val, name) => name === 'revenue' ? [`${val.toFixed(2)} Bs.`, 'Ingresos'] : [val, 'Unidades']} />
                                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                <Bar dataKey="quantity" name="Unidades vendidas" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="revenue"  name="Ingresos (Bs.)"   fill="#818cf8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
