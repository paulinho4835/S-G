import React, { useEffect, useState, useMemo } from 'react';
import {
    Package, Search, FilterX, Download, Store, Pin,
    ShoppingCart, ClipboardList, Truck, X, ChevronDown
} from 'lucide-react';
import * as api from '../lib/api';
import SalesModal from './SalesModal';
import EditPartModal from './EditPartModal';
import AdjustStockModal from './AdjustStockModal';
import KardexModal from './KardexModal';
import ConfirmDialog from './ConfirmDialog';
import { SkeletonTable } from './Skeleton';
import { toast } from '../lib/toast';


export default function PartList({ refreshTrigger, wholesaleMode: wholesaleModeFromProp, setWholesaleMode: setWholesaleModeFromProp, onAddToWholesaleCart }) {
    const [localWholesaleMode, setLocalWholesaleMode] = useState(false);
    const wholesaleMode = wholesaleModeFromProp !== undefined ? wholesaleModeFromProp : localWholesaleMode;
    const setWholesaleMode = setWholesaleModeFromProp ?? setLocalWholesaleMode;
    const [parts, setParts] = useState([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({ internal: '', external: '', height: '' });
    const [selectedPartForSale, setSelectedPartForSale] = useState(null);
    const [selectedPartForEdit, setSelectedPartForEdit] = useState(null);
    const [selectedPartForRestock, setSelectedPartForRestock] = useState(null);
    const [selectedPartForKardex, setSelectedPartForKardex] = useState(null);
    const [stockMode, setStockMode] = useState('add');
    const [loading, setLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const [recentParts, setRecentParts] = useState(() => {
        const saved = localStorage.getItem('recentParts');
        return saved ? JSON.parse(saved) : [];
    });
    const [renderLimit, setRenderLimit] = useState(100);
    const [selectedRowId, setSelectedRowId] = useState(null);
    const internalInputRef = React.useRef(null);
    const headerRef = React.useRef(null);
    const loadMoreRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    // Atajo "/" desde App: enfoca y selecciona la búsqueda
    useEffect(() => {
        const focusSearch = () => {
            const el = searchInputRef.current;
            if (el) { el.focus(); el.select(); }
        };
        window.addEventListener('focus-product-search', focusSearch);
        return () => window.removeEventListener('focus-product-search', focusSearch);
    }, []);
    const [headerHeight, setHeaderHeight] = useState(200);

    useEffect(() => {
        if (headerRef.current) {
            const updateHeight = () => setHeaderHeight(headerRef.current.offsetHeight + 10);
            updateHeight();
            const observer = new ResizeObserver(() => updateHeight());
            observer.observe(headerRef.current);
            return () => observer.disconnect();
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('recentParts', JSON.stringify(recentParts));
    }, [recentParts]);

    // Debounce: el filtrado real se aplica ~200ms después de dejar de teclear.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(t);
    }, [search]);

    const toggleRecent = (part) => {
        setRecentParts(prev => {
            const exists = prev.find(p => p.id === part.id);
            if (exists) {
                toast.info(`"${part.codigo_producto || part.name}" desanclado`);
                return prev.filter(p => p.id !== part.id);
            } else {
                toast.success(`"${part.codigo_producto || part.name}" anclado arriba`);
                return [part, ...prev].slice(0, 10);
            }
        });
    };

    const handleAddToOrder = (part) => {
        const currentOrders = JSON.parse(localStorage.getItem('pedidos_list') || '[]');
        const newOrder = {
            ...part,
            order_id: Date.now() + Math.random().toString(36).substring(7),
            order_date: new Date().toISOString()
        };
        localStorage.setItem('pedidos_list', JSON.stringify([...currentOrders, newOrder]));
        toast.success('Agregado a Pedidos correctamente');
    };

    const fetchParts = async () => {
        if (parts.length === 0) setLoading(true);
        try {
            const data = await api.getParts();
            if (data.message === 'success') setParts(data.data);
        } catch (error) {
            console.error('Error fetching parts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchParts(); }, [refreshTrigger]);

    const filteredParts = useMemo(() => {
        const result = parts.filter(part => {
            if (debouncedSearch) {
                const searchLower = debouncedSearch.toLowerCase();
                const matchesCode = part.codigo?.toLowerCase().includes(searchLower);
                const matchesCodigoProducto = part.codigo_producto?.toLowerCase().includes(searchLower);
                const matchesName = part.name?.toLowerCase().includes(searchLower);
                const matchesBrand = part.marca?.toLowerCase().includes(searchLower);
                const matchesApp = part.aplicacion?.toLowerCase().includes(searchLower);
                const matchesFamily = part.familia?.toLowerCase().includes(searchLower);
                const matchesMundial = part.mundial?.toLowerCase().includes(searchLower);
                const matchesInternal = String(part.internal_measure || '').includes(searchLower);
                const matchesExternal = String(part.external_measure || '').includes(searchLower);
                const matchesHeight = String(part.height || '').includes(searchLower);
                const matchesFlange = String(part.flange_measure || '').includes(searchLower);
                const matchesTope = String(part.tope || '').includes(searchLower);
                if (!matchesCode && !matchesCodigoProducto && !matchesName && !matchesBrand &&
                    !matchesApp && !matchesFamily && !matchesMundial && !matchesInternal &&
                    !matchesExternal && !matchesHeight && !matchesFlange && !matchesTope) {
                    return false;
                }
            }

            const TOLERANCE = 0.5;
            if (filters.internal) {
                const val = parseFloat(filters.internal);
                const partVal = parseFloat(part.internal_measure);
                if (isNaN(partVal) || Math.abs(partVal - val) > TOLERANCE) return false;
            }
            if (filters.external) {
                const val = parseFloat(filters.external);
                const partVal = parseFloat(part.external_measure);
                if (isNaN(partVal) || Math.abs(partVal - val) > TOLERANCE) return false;
            }
            if (filters.height) {
                const val = parseFloat(filters.height);
                const partVal = parseFloat(part.height);
                if (isNaN(partVal) || Math.abs(partVal - val) > TOLERANCE) return false;
            }
            return true;
        });

        if (filters.internal) {
            const target = parseFloat(filters.internal);
            const getGroup = (val) => val < target ? 1 : val === target ? 2 : 3;
            return [...result].sort((a, b) => {
                const valA = parseFloat(a.internal_measure || 0);
                const valB = parseFloat(b.internal_measure || 0);
                const groupA = getGroup(valA);
                const groupB = getGroup(valB);
                if (groupA !== groupB) return groupA - groupB;
                if (valA !== valB) return valA - valB;
                const extA = parseFloat(a.external_measure || 0);
                const extB = parseFloat(b.external_measure || 0);
                if (extA !== extB) return extA - extB;
                return parseFloat(a.height || 0) - parseFloat(b.height || 0);
            });
        }

        if (filters.external) {
            const targetExt = parseFloat(filters.external);
            const getExtGroup = (val) => val < targetExt ? 1 : val === targetExt ? 2 : 3;
            return [...result].sort((a, b) => {
                const valA = parseFloat(a.external_measure || 0);
                const valB = parseFloat(b.external_measure || 0);
                const groupA = getExtGroup(valA);
                const groupB = getExtGroup(valB);
                if (groupA !== groupB) return groupA - groupB;
                if (valA !== valB) return valA - valB;
                const intA = parseFloat(a.internal_measure || 0);
                const intB = parseFloat(b.internal_measure || 0);
                if (intA !== intB) return intA - intB;
                return parseFloat(a.height || 0) - parseFloat(b.height || 0);
            });
        }

        if (filters.height) {
            const targetH = parseFloat(filters.height);
            return [...result].sort((a, b) => {
                const diffA = Math.abs(parseFloat(a.height || 0) - targetH);
                const diffB = Math.abs(parseFloat(b.height || 0) - targetH);
                return diffA - diffB;
            });
        }

        return result;
    }, [parts, debouncedSearch, filters]);

    useEffect(() => { setRenderLimit(100); }, [debouncedSearch, filters]);

    // Renderizado progresivo: solo se montan `renderLimit` filas a la vez.
    const paginatedParts = useMemo(
        () => filteredParts.slice(0, renderLimit),
        [filteredParts, renderLimit]
    );

    // Auto-carga: cuando el centinela del fondo se acerca al viewport,
    // se montan 100 filas más (scroll infinito). Mantiene el DOM acotado
    // durante el uso normal en lugar de pintar miles de filas de golpe.
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setRenderLimit(prev => (prev < filteredParts.length ? prev + 100 : prev));
                }
            },
            { rootMargin: '400px' }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [filteredParts.length]);

    const handleDelete = (id) => {
        setConfirmModal({
            message: '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    await api.deletePart(id);
                    fetchParts();
                    toast.success('Producto eliminado correctamente');
                } catch (error) {
                    toast.error(error.message || 'No se pudo eliminar el producto.');
                }
            }
        });
    };

    const handleConfirmSale = async (saleData) => {
        try {
            await api.createSale(saleData);
            toast.success('Venta registrada correctamente');
            setSelectedPartForSale(null);
            fetchParts();
        } catch (error) {
            toast.error('Error: ' + error.message);
        }
    };

    const handleRestock = async (qty) => {
        const part = selectedPartForRestock;
        if (!part) return;
        try {
            await api.restock(part.id, qty);
            toast.success('Stock actualizado correctamente');
            setSelectedPartForRestock(null);
            fetchParts();
        } catch (error) {
            toast.error('Error: ' + error.message);
        }
    };

    const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

    const handleDownloadExcel = () => api.exportPartsExcel(parts);

    const handleReset = () => {
        setSearch('');
        setFilters({ internal: '', external: '', height: '' });
        internalInputRef.current?.focus();
    };

    const scrollToSearch = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => internalInputRef.current?.focus(), 500);
    };

    /* ── Estilos de botones de acción (inline compactos) ── */
    const btnBase = { fontSize: '0.78rem', padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' };
    const btnVender  = { ...btnBase, backgroundColor: 'var(--accent-color)', color: '#06100e' };
    const btnEdit    = { ...btnBase, backgroundColor: '#4f46e5', color: '#fff' };
    const btnDanger  = { ...btnBase, background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' };
    const btnSuccess = { ...btnBase, backgroundColor: '#14965a', color: '#fff' };
    const btnRemove  = { ...btnBase, backgroundColor: '#b91c1c', color: '#fff' };
    const btnPurple  = { ...btnBase, backgroundColor: '#5b21b6', color: '#fff' };
    const btnYellow  = { ...btnBase, backgroundColor: '#b45309', color: '#fff' };

    return (
        <div>
            {/* ── Barra de filtros sticky ── */}
            <div
                ref={headerRef}
                style={{
                    marginBottom: '1.5rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    backgroundColor: 'var(--surface-3)',
                    borderBottom: '1px solid var(--border-color)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                    padding: '0.65rem 1rem',
                    borderRadius: '0 0 8px 8px'
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <Package size={16} color="var(--accent-color)" />
                        Productos
                    </h2>

                    <input
                        ref={searchInputRef}
                        className="search-green"
                        placeholder="Buscar código, marca o aplicación...  ( / )"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: '270px', padding: '0.45rem 0.7rem', fontSize: '0.84rem', margin: 0 }}
                    />

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input ref={internalInputRef} name="internal" className="filter-input" placeholder="MI" type="number" step="0.01" value={filters.internal} onChange={handleFilterChange} style={{ width: '100px', padding: '0.45rem', fontSize: '0.84rem', margin: 0 }} title="Medida Interna" />
                        <input name="external" className="filter-input" placeholder="ME" type="number" step="0.01" value={filters.external} onChange={handleFilterChange} style={{ width: '100px', padding: '0.45rem', fontSize: '0.84rem', margin: 0 }} title="Medida Externa" />
                        <input name="height" className="filter-input" placeholder="ALT" type="number" step="0.01" value={filters.height} onChange={handleFilterChange} style={{ width: '100px', padding: '0.45rem', fontSize: '0.84rem', margin: 0 }} title="Altura" />
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                            onClick={handleReset}
                            style={{ ...btnBase, backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '5px 10px' }}
                            title="Limpiar Filtros"
                        >
                            <FilterX size={14} />
                        </button>
                        <button
                            onClick={handleDownloadExcel}
                            style={{ ...btnBase, backgroundColor: '#14532d', color: '#d4f8e0', border: '1px solid #166534' }}
                            title="Descargar Excel"
                        >
                            <Download size={14} />
                            Excel
                        </button>
                    </div>

                    {/* Toggle Modo Mayorista */}
                    <div
                        onClick={() => setWholesaleMode && setWholesaleMode(m => !m)}
                        title={wholesaleMode ? 'Desactivar Modo Mayorista' : 'Activar Modo Mayorista'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            cursor: 'pointer', userSelect: 'none',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            border: `1px solid ${wholesaleMode ? 'var(--accent-color)' : 'var(--border-color)'}`,
                            backgroundColor: wholesaleMode ? 'var(--accent-dim)' : 'transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Store size={13} color={wholesaleMode ? 'var(--accent-color)' : 'var(--text-secondary)'} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: wholesaleMode ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                            Mayorista
                        </span>
                        <div style={{
                            width: '34px', height: '18px',
                            backgroundColor: wholesaleMode ? 'var(--accent-color)' : 'var(--border-strong)',
                            borderRadius: '9px', position: 'relative', transition: 'background 0.2s'
                        }}>
                            <div style={{
                                position: 'absolute', top: '3px',
                                left: wholesaleMode ? '16px' : '3px',
                                width: '12px', height: '12px',
                                backgroundColor: 'white', borderRadius: '50%',
                                transition: 'left 0.2s'
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Productos Anclados ── */}
            {recentParts.length > 0 && (
                <div className="glass-panel" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent-dim)', backgroundColor: 'rgba(212,144,10,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Pin size={14} />
                            Productos Anclados
                        </h3>
                        <button
                            onClick={() => setRecentParts([])}
                            style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        >
                            Limpiar todos
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                        {recentParts.map(part => (
                            <div key={`recent-${part.id}`} style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                backgroundColor: 'var(--surface-2)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px', padding: '4px 8px',
                                fontSize: '0.78rem', whiteSpace: 'nowrap'
                            }}>
                                <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{part.codigo_producto || part.name}</span>
                                <span style={{ color: (part.stock || 0) > 0 ? '#34d399' : '#f87171', fontFamily: 'var(--font-mono)' }}>×{part.stock || 0}</span>
                                <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>Bs.{parseFloat(part.cost_price || 0).toFixed(2)}</span>
                                <div style={{ display: 'flex', gap: '2px', marginLeft: '2px' }}>
                                    {onAddToWholesaleCart && (
                                        <button onClick={() => onAddToWholesaleCart(part)} disabled={(part.stock ?? 0) <= 0}
                                            style={{ ...btnBase, backgroundColor: 'var(--accent-color)', color: '#07111e', padding: '2px 5px', fontSize: '0.7rem' }}
                                            title="Agregar al Carrito Mayorista">
                                            <ShoppingCart size={10} />M
                                        </button>
                                    )}
                                    <button onClick={() => setSelectedPartForSale(part)} disabled={(part.stock ?? 0) <= 0}
                                        style={{ ...btnVender, padding: '2px 6px', fontSize: '0.7rem' }}>Vender</button>
                                    <button onClick={() => setSelectedPartForEdit(part)}
                                        style={{ ...btnEdit, padding: '2px 6px', fontSize: '0.7rem' }}>Modi.</button>
                                    <button onClick={() => { setStockMode('add'); setSelectedPartForRestock(part); }}
                                        style={{ ...btnSuccess, padding: '2px 6px', fontSize: '0.7rem' }}>+</button>
                                    <button onClick={() => { setStockMode('remove'); setSelectedPartForRestock(part); }}
                                        style={{ ...btnRemove, padding: '2px 6px', fontSize: '0.7rem' }}>-</button>
                                    <button onClick={() => toggleRecent(part)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px' }}
                                        title="Quitar de anclados">
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
            {selectedPartForSale && (
                <SalesModal part={selectedPartForSale} onClose={() => setSelectedPartForSale(null)} onConfirm={handleConfirmSale} />
            )}
            {selectedPartForEdit && (
                <EditPartModal part={selectedPartForEdit} onClose={() => setSelectedPartForEdit(null)} onConfirm={fetchParts} />
            )}
            {selectedPartForRestock && (
                <AdjustStockModal part={selectedPartForRestock} mode={stockMode} onClose={() => setSelectedPartForRestock(null)} onConfirm={handleRestock} />
            )}
            {selectedPartForKardex && (
                <KardexModal part={selectedPartForKardex} onClose={() => setSelectedPartForKardex(null)} />
            )}

            {/* ── Tabla de productos ── */}
            <div>
                {loading ? (
                    <SkeletonTable rows={10} cols={8} />
                ) : (
                    <>
                        <div className="table-scroll">
                        <table className="products-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--card-bg)', borderRadius: '8px' }}>
                            <thead className="sticky-head" style={{ '--sticky-top': `${headerHeight}px` }}>
                                <tr>
                                    <th>Familia</th>
                                    <th>Cód. Producto</th>
                                    <th>Código</th>
                                    <th>Marca</th>
                                    <th>Mundial</th>
                                    <th style={{ fontFamily: 'var(--font-mono)' }}>MI</th>
                                    <th style={{ fontFamily: 'var(--font-mono)' }}>ME</th>
                                    <th style={{ fontFamily: 'var(--font-mono)' }}>ALT</th>
                                    <th style={{ fontFamily: 'var(--font-mono)', color: '#f05252' }}>PES</th>
                                    <th style={{ fontFamily: 'var(--font-mono)', color: '#f05252' }}>TOP</th>
                                    <th>Precio Base</th>
                                    <th>PV Gelipe</th>
                                    <th>Stock</th>
                                    <th>Aplicación</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedParts.map(part => (
                                    <tr
                                        key={part.id}
                                        className={selectedRowId === part.id ? 'selected-row' : ''}
                                        onClick={() => setSelectedRowId(part.id)}
                                        style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                    >
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{part.familia || '—'}</td>
                                        <td onDoubleClick={() => toggleRecent(part)} title="Doble clic para anclar">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{part.codigo_producto || part.name || '—'}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleRecent(part); }}
                                                    style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: recentParts.find(p => p.id === part.id) ? 'var(--accent-color)' : 'var(--text-muted)' }}
                                                    title="Anclar/Desanclar"
                                                >
                                                    <Pin size={12} fill={recentParts.find(p => p.id === part.id) ? 'currentColor' : 'none'} />
                                                </button>
                                            </div>
                                        </td>
                                        <td
                                            className="highlight-location"
                                            style={{ fontSize: '0.9rem', cursor: 'pointer', textAlign: 'center' }}
                                            onDoubleClick={() => toggleRecent(part)}
                                            title="Ubicación. Doble clic para anclar"
                                        >
                                            {part.codigo || '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{part.marca || '—'}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{part.mundial || '—'}</td>
                                        <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{part.internal_measure || '0'}</td>
                                        <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{part.external_measure || '0'}</td>
                                        <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{part.height || '0'}</td>
                                        <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: '#f05252' }}>{part.flange_measure || '0'}</td>
                                        <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: '#f05252' }}>{part.tope || '0'}</td>
                                        <td style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                                            {part.cost_price ? `Bs.${parseFloat(part.cost_price).toFixed(2)}` : '—'}
                                        </td>
                                        <td style={{ color: 'var(--accent-color)', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{part.pv_geli || '—'}</td>
                                        <td>
                                            <span className={`stock-badge ${(part.stock ?? 0) > 0 ? 'stock-badge-ok' : 'stock-badge-zero'}`}>
                                                {part.stock ?? 0}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {part.aplicacion || part.description || '—'}
                                        </td>
                                        <td style={{ minWidth: '280px' }}>
                                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                                {wholesaleMode ? (
                                                    <button
                                                        onClick={() => onAddToWholesaleCart && onAddToWholesaleCart(part)}
                                                        disabled={(part.stock ?? 0) <= 0}
                                                        style={{ ...btnBase, backgroundColor: (part.stock ?? 0) <= 0 ? 'var(--surface-2)' : 'var(--accent-color)', color: (part.stock ?? 0) <= 0 ? 'var(--text-muted)' : '#07111e', cursor: (part.stock ?? 0) <= 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem', padding: '6px 14px' }}
                                                        title={(part.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar al carrito mayorista'}
                                                    >
                                                        <ShoppingCart size={13} /> Mayor
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setSelectedPartForSale(part)} disabled={(part.stock ?? 0) <= 0} style={btnVender}>Vender</button>
                                                        <button onClick={() => setSelectedPartForEdit(part)} style={btnEdit}>Modificar</button>
                                                        <button className="danger" style={{ ...btnDanger, fontSize: '0.78rem', padding: '5px 10px' }} onClick={() => handleDelete(part.id)}>Eliminar</button>
                                                        <button onClick={() => { setStockMode('add'); setSelectedPartForRestock(part); }} style={btnSuccess}>+ Stock</button>
                                                        <button onClick={() => { setStockMode('remove'); setSelectedPartForRestock(part); }} style={btnRemove}>− Stock</button>
                                                        <button onClick={() => setSelectedPartForKardex(part)} style={btnPurple} title="Ver historial de movimientos">
                                                            <ClipboardList size={13} /> Kardex
                                                        </button>
                                                        <button onClick={() => handleAddToOrder(part)} style={btnYellow} title="Agregar a la lista de Pedidos">
                                                            <Truck size={13} /> Pedido
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>

                        {/* Centinela: dispara la auto-carga de más filas al acercarse */}
                        <div ref={loadMoreRef} aria-hidden="true" style={{ height: 1 }} />

                        {filteredParts.length > paginatedParts.length && (
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginTop: '1.5rem', padding: '0.85rem 1rem',
                                border: '1px solid var(--border-color)', borderRadius: '8px',
                                backgroundColor: 'var(--surface-2)', flexWrap: 'wrap', gap: '0.75rem'
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ChevronDown size={14} className="bounce-down" />
                                    Mostrando <strong style={{ color: 'var(--text-primary)' }}>{paginatedParts.length}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{filteredParts.length}</strong> — desliza para ver más
                                </span>
                                <button
                                    onClick={() => setRenderLimit(filteredParts.length)}
                                    style={{ ...btnBase, backgroundColor: '#4f46e5', color: '#fff' }}
                                >
                                    Ver todos ({filteredParts.length})
                                </button>
                            </div>
                        )}

                        {filteredParts.length <= paginatedParts.length && filteredParts.length > 0 && (
                            <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {filteredParts.length} resultados encontrados
                            </div>
                        )}

                        {filteredParts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.015)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No se encontraron repuestos.</p>
                                <p style={{ fontSize: '0.88rem' }}>Usa "Carga Masiva" para importar productos desde Excel, o registra uno nuevo.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── FAB buscar ── */}
            <button onClick={scrollToSearch} className="fab" title="Nueva Búsqueda">
                <Search size={20} />
            </button>
        </div>
    );
}
