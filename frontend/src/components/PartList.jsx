import React, { useEffect, useState, useMemo } from 'react';
import * as api from '../lib/api';
import SalesModal from './SalesModal';
import EditPartModal from './EditPartModal';
import AdjustStockModal from './AdjustStockModal';
import KardexModal from './KardexModal';
import ConfirmDialog from './ConfirmDialog';
import { toast } from '../lib/toast';


export default function PartList({ refreshTrigger, wholesaleMode, setWholesaleMode, onAddToWholesaleCart }) {
    const [parts, setParts] = useState([]);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ internal: '', external: '', height: '' });
    const [selectedPartForSale, setSelectedPartForSale] = useState(null);
    const [selectedPartForEdit, setSelectedPartForEdit] = useState(null);
    const [selectedPartForRestock, setSelectedPartForRestock] = useState(null);
    const [selectedPartForKardex, setSelectedPartForKardex] = useState(null);
    const [stockMode, setStockMode] = useState('add'); // 'add' or 'remove'
    const [loading, setLoading] = useState(false);
        const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
    const [recentParts, setRecentParts] = useState(() => {
        const saved = localStorage.getItem('recentParts');
        return saved ? JSON.parse(saved) : [];
    });
    const [renderLimit, setRenderLimit] = useState(100);
    const [selectedRowId, setSelectedRowId] = useState(null);
    const internalInputRef = React.useRef(null);
    const headerRef = React.useRef(null);
    const [headerHeight, setHeaderHeight] = useState(200);

    useEffect(() => {
        if (headerRef.current) {
            const updateHeight = () => {
                // Add an offset (e.g., 20px) to account for padding/margin if needed
                setHeaderHeight(headerRef.current.offsetHeight + 10); 
            };
            updateHeight();
            const observer = new ResizeObserver(() => updateHeight());
            observer.observe(headerRef.current);
            return () => observer.disconnect();
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('recentParts', JSON.stringify(recentParts));
    }, [recentParts]);

    const toggleRecent = (part) => {
        setRecentParts(prev => {
            const exists = prev.find(p => p.id === part.id);
            if (exists) {
                return prev.filter(p => p.id !== part.id);
            } else {
                return [part, ...prev].slice(0, 10); // Keep last 10 for better UX
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
        const updatedOrders = [...currentOrders, newOrder];
        localStorage.setItem('pedidos_list', JSON.stringify(updatedOrders));
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

    useEffect(() => {
        fetchParts();
    }, [refreshTrigger]);

    const filteredParts = useMemo(() => {
        const result = parts.filter(part => {
            // 1. General Search Filter
            if (search) {
                const searchLower = search.toLowerCase();
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

                if (
                    !matchesCode &&
                    !matchesCodigoProducto &&
                    !matchesName &&
                    !matchesBrand &&
                    !matchesApp && 
                    !matchesFamily && 
                    !matchesMundial &&
                    !matchesInternal &&
                    !matchesExternal &&
                    !matchesHeight &&
                    !matchesFlange &&
                    !matchesTope
                ) {
                    return false;
                }
            }

            // 2. Specific Dimension Filters
            const TOLERANCE = 0.5; // Tolerancia fija por defecto de 0.5mm para incluir las medidas más cercanas en el catálogo

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

        // 3. Smart Sorting: Group by (menor < exacto < mayor) respecto a la medida interna buscada
        if (filters.internal) {
            const target = parseFloat(filters.internal);

            // Función que asigna el grupo de ordenamiento:
            // Grupo 1: Medidas menores al objetivo (van primero, ascendente)
            // Grupo 2: Medidas exactamente iguales al objetivo (van en el medio)
            // Grupo 3: Medidas mayores al objetivo (van al final, ascendente)
            const getGroup = (val) => {
                if (val < target) return 1;
                if (val === target) return 2;
                return 3;
            };

            return [...result].sort((a, b) => {
                const valA = parseFloat(a.internal_measure || 0);
                const valB = parseFloat(b.internal_measure || 0);

                const groupA = getGroup(valA);
                const groupB = getGroup(valB);

                // Primero ordenar por grupo (1 -> 2 -> 3)
                if (groupA !== groupB) return groupA - groupB;

                // Dentro del mismo grupo, ordenar por medida interna ascendente
                if (valA !== valB) return valA - valB;

                // Desempate 1: medida externa ascendente
                const extA = parseFloat(a.external_measure || 0);
                const extB = parseFloat(b.external_measure || 0);
                if (extA !== extB) return extA - extB;

                // Desempate 2: altura ascendente
                return parseFloat(a.height || 0) - parseFloat(b.height || 0);
            });
        }

        // Si hay filtro de medida externa (sin medida interna), aplicar ordenamiento 3-grupos
        if (filters.external) {
            const targetExt = parseFloat(filters.external);
            const getExtGroup = (val) => {
                if (val < targetExt) return 1;  // Menores primero
                if (val === targetExt) return 2; // Exactas en medio
                return 3;                        // Mayores al final
            };
            return [...result].sort((a, b) => {
                const valA = parseFloat(a.external_measure || 0);
                const valB = parseFloat(b.external_measure || 0);
                const groupA = getExtGroup(valA);
                const groupB = getExtGroup(valB);
                if (groupA !== groupB) return groupA - groupB;
                if (valA !== valB) return valA - valB;
                // Desempate: medida interna ascendente, luego altura
                const intA = parseFloat(a.internal_measure || 0);
                const intB = parseFloat(b.internal_measure || 0);
                if (intA !== intB) return intA - intB;
                return parseFloat(a.height || 0) - parseFloat(b.height || 0);
            });
        }

        // Fallback: ordenar por altura si solo hay filtro de altura
        if (filters.height) {
            const targetH = parseFloat(filters.height);
            return [...result].sort((a, b) => {
                const diffA = Math.abs(parseFloat(a.height || 0) - targetH);
                const diffB = Math.abs(parseFloat(b.height || 0) - targetH);
                return diffA - diffB;
            });
        }

        return result;
    }, [parts, search, filters]);

    useEffect(() => {
        setRenderLimit(100);
    }, [search, filters]);

    const paginatedParts = useMemo(() => {
        const limit = (search || filters.internal || filters.external || filters.height) ? 1000 : renderLimit;
        return filteredParts.slice(0, limit);
    }, [filteredParts, renderLimit, search, filters]);

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

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleDownloadExcel = () => {
        api.exportPartsExcel(parts);
    };

    const handleReset = () => {
        setSearch('');
        setFilters({ internal: '', external: '', height: '' });
        if (internalInputRef.current) {
            internalInputRef.current.focus();
        }
    };

    const scrollToSearch = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            if (internalInputRef.current) {
                internalInputRef.current.focus();
            }
        }, 500); // Wait for scroll to finish
    };

    return (
        <div>
            {recentParts.length > 0 && (
                <div className="glass-panel" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent-color)', backgroundColor: 'rgba(56, 189, 248, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📍 Productos Recientes (Acceso Rápido)
                        </h3>
                        <button
                            onClick={() => setRecentParts([])}
                            style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                            Limpiar todos
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {recentParts.map(part => (
                            <div key={`recent-${part.id}`} className="card" style={{ padding: '0.8rem', position: 'relative' }}>
                                <button
                                    onClick={() => toggleRecent(part)}
                                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'transparent', color: '#f87171', padding: '4px', zIndex: 10 }}
                                    title="Quitar de recientes"
                                >
                                    ✕
                                </button>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--accent-color)' }}>{part.codigo_producto || part.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cod: {part.codigo || '-'}</div>
                                <div style={{ fontSize: '0.85rem', margin: '4px 0', minHeight: '1.2rem', fontStyle: 'italic' }}>{part.aplicacion || '-'}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>Bs. {parseFloat(part.cost_price || 0).toFixed(2)}</span>
                                    <span style={{ fontSize: '0.85rem', color: (part.stock || 0) > 0 ? '#34d399' : '#f87171' }}>Stock: {part.stock || 0}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
                                    {onAddToCart && (
                                        <button
                                            onClick={() => onAddToCart(part)}
                                            disabled={(part.stock ?? 0) <= 0}
                                            style={{ backgroundColor: '#f59e0b', fontSize: '0.75rem', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0f172a', fontWeight: 'bold' }}
                                            title="Agregar al Carrito Mayorista"
                                        >
                                            + Mayor
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedPartForSale(part)}
                                        disabled={(part.stock ?? 0) <= 0}
                                        className="primary"
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                                    >
                                        Vender
                                    </button>
                                    <button
                                        onClick={() => setSelectedPartForEdit(part)}
                                        style={{ backgroundColor: '#6366f1', fontSize: '0.75rem', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                                    >
                                        Modi.
                                    </button>
                                    <button
                                        onClick={() => { setStockMode('add'); setSelectedPartForRestock(part); }}
                                        style={{ backgroundColor: '#10b981', fontSize: '0.75rem', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => { setStockMode('remove'); setSelectedPartForRestock(part); }}
                                        style={{ backgroundColor: '#f43f5e', fontSize: '0.75rem', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                                    >
                                        -
                                    </button>
                                    <button
                                        onClick={() => handleAddToOrder(part)}
                                        style={{ backgroundColor: '#eab308', fontSize: '0.75rem', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                                        title="Agregar a Pedidos"
                                    >
                                        📦
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div ref={headerRef} className="glass-panel" style={{ marginBottom: '1.5rem', position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', whiteSpace: 'nowrap' }}>📦 Productos</h2>

                    <div>
                        <input
                            className="search-green"
                            placeholder="Buscar código, marca o aplicación..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '280px', padding: '0.5rem', fontSize: '0.85rem', margin: 0, backgroundColor: '#16a34a', color: 'white', border: '2px solid #22c55e', borderRadius: '6px', fontWeight: '500' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input ref={internalInputRef} name="internal" className="filter-input" placeholder="MI" type="number" step="0.01" value={filters.internal} onChange={handleFilterChange} style={{ width: '110px', padding: '0.5rem', fontSize: '0.85rem', margin: 0 }} title="Medida Interna" />
                        <input name="external" className="filter-input" placeholder="ME" type="number" step="0.01" value={filters.external} onChange={handleFilterChange} style={{ width: '110px', padding: '0.5rem', fontSize: '0.85rem', margin: 0 }} title="Medida Externa" />
                        <input name="height" className="filter-input" placeholder="ALT" type="number" step="0.01" value={filters.height} onChange={handleFilterChange} style={{ width: '110px', padding: '0.5rem', fontSize: '0.85rem', margin: 0 }} title="Altura" />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={handleReset} className="danger" style={{ padding: '0.5rem', fontSize: '1rem', backgroundColor: '#475569', border: 'none', minWidth: '40px', display: 'flex', justifyContent: 'center' }} title="Limpiar Filtros">🧹</button>
                        <button onClick={handleDownloadExcel} className="primary" style={{ backgroundColor: '#059669', padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Descargar Excel">📥 Excel</button>
                    </div>

                    {/* Switch Modo Mayorista */}
                    <div
                        onClick={() => setWholesaleMode && setWholesaleMode(m => !m)}
                        title={wholesaleMode ? 'Desactivar Modo Mayorista' : 'Activar Modo Mayorista'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            cursor: 'pointer', userSelect: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '20px',
                            border: `1px solid ${wholesaleMode ? '#f59e0b' : '#475569'}`,
                            backgroundColor: wholesaleMode ? 'rgba(245,158,11,0.15)' : 'transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: wholesaleMode ? '#f59e0b' : 'var(--text-secondary)' }}>
                            🏪 Modo Mayorista
                        </span>
                        <div style={{
                            width: '36px', height: '20px',
                            backgroundColor: wholesaleMode ? '#f59e0b' : '#334155',
                            borderRadius: '10px', position: 'relative', transition: 'background 0.2s'
                        }}>
                            <div style={{
                                position: 'absolute', top: '3px',
                                left: wholesaleMode ? '18px' : '3px',
                                width: '14px', height: '14px',
                                backgroundColor: 'white', borderRadius: '50%',
                                transition: 'left 0.2s'
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {confirmModal && (
                <ConfirmDialog
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {selectedPartForSale && (
                <SalesModal
                    part={selectedPartForSale}
                    onClose={() => setSelectedPartForSale(null)}
                    onConfirm={handleConfirmSale}
                />
            )}

            {selectedPartForEdit && (
                <EditPartModal
                    part={selectedPartForEdit}
                    onClose={() => setSelectedPartForEdit(null)}
                    onConfirm={fetchParts}
                />
            )}

            {selectedPartForRestock && (
                <AdjustStockModal
                    part={selectedPartForRestock}
                    mode={stockMode}
                    onClose={() => setSelectedPartForRestock(null)}
                    onConfirm={handleRestock}
                />
            )}

            {selectedPartForKardex && (
                <KardexModal
                    part={selectedPartForKardex}
                    onClose={() => setSelectedPartForKardex(null)}
                />
            )}

            <div>
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Cargando productos...</p>
                    </div>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--card-bg)', borderRadius: '8px' }}>
                            <thead style={{ position: 'sticky', top: `${headerHeight}px`, zIndex: 90 }}>
                                <tr style={{ textAlign: 'left', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                    <th style={{ padding: '8px' }}>Familia</th>
                                    <th style={{ padding: '8px' }}>Codigo Producto</th>
                                    <th style={{ padding: '8px' }}>Codigo</th>

                                    <th style={{ padding: '8px' }}>Marca</th>
                                    <th style={{ padding: '8px' }}>Mundial</th>
                                    <th style={{ padding: '8px' }}>MI</th>
                                    <th style={{ padding: '8px' }}>ME</th>
                                    <th style={{ padding: '8px' }}>ALT</th>
                                    <th style={{ padding: '8px' }}>PES</th>
                                    <th style={{ padding: '8px' }}>TOP</th>
                                    <th style={{ padding: '8px' }}>Precio Base</th>
                                    <th style={{ padding: '8px' }}>PV GELIPE</th>
                                    <th style={{ padding: '8px' }}>Stock</th>
                                    <th style={{ padding: '8px' }}>Aplicación</th>
                                    <th style={{ padding: '8px' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedParts.map(part => (
                                    <tr 
                                        key={part.id} 
                                        className={selectedRowId === part.id ? 'selected-row' : ''}
                                        onClick={() => setSelectedRowId(part.id)}
                                        style={{ borderBottom: '1px solid #334155', cursor: 'pointer', transition: 'all 0.2s' }}
                                    >
                                        <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{part.familia || '-'}</td>
                                        <td
                                            style={{ padding: '8px' }}
                                            onDoubleClick={() => toggleRecent(part)}
                                            title="Doble clic para anclar a Recientes"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '0.85rem' }}>{part.codigo_producto || part.name || '-'}</div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleRecent(part); }}
                                                    style={{ background: 'transparent', padding: '2px', fontSize: '0.9rem', opacity: recentParts.find(p => p.id === part.id) ? 1 : 0.3 }}
                                                    title="Anclar/Desanclar de Recientes"
                                                >
                                                    📍
                                                </button>
                                            </div>
                                        </td>
                                        <td
                                            className="highlight-location"
                                            style={{ padding: '8px', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'center' }}
                                            onDoubleClick={() => toggleRecent(part)}
                                            title="Ubicación. Doble clic para anclar a Recientes"
                                        >
                                            {part.codigo || '-'}
                                        </td>

                                        <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{part.marca || '-'}</td>
                                        <td style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{part.mundial || '-'}</td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{part.internal_measure || '0'}</td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{part.external_measure || '0'}</td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{part.height || '0'}</td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem', color: '#34d399' }}>{part.flange_measure || '0'}</td>
                                        <td style={{ padding: '8px', fontSize: '0.85rem', color: '#60a5fa' }}>{part.tope || '0'}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>
                                            {part.cost_price ? `Bs. ${parseFloat(part.cost_price).toFixed(2)}` : '-'}
                                        </td>
                                        <td style={{ padding: '8px', color: '#f59e0b', fontSize: '1rem', fontWeight: 'bold' }}>{part.pv_geli || '-'}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: (part.stock ?? 0) > 0 ? '#16a34a' : 'rgba(239, 68, 68, 0.2)',
                                                color: (part.stock ?? 0) > 0 ? 'white' : '#f87171',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem'
                                            }}>
                                                {part.stock ?? 0}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            {part.aplicacion || part.description || '-'}
                                        </td>
                                        <td style={{ padding: '8px', minWidth: '320px' }}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {wholesaleMode ? (
                                                    <button
                                                        onClick={() => onAddToWholesaleCart && onAddToWholesaleCart(part)}
                                                        disabled={(part.stock ?? 0) <= 0}
                                                        style={{
                                                            fontSize: '0.85rem', padding: '6px 16px',
                                                            backgroundColor: (part.stock ?? 0) <= 0 ? '#374151' : '#f59e0b',
                                                            color: (part.stock ?? 0) <= 0 ? '#6b7280' : '#0f172a',
                                                            border: 'none', borderRadius: '6px',
                                                            cursor: (part.stock ?? 0) <= 0 ? 'not-allowed' : 'pointer',
                                                            fontWeight: 'bold'
                                                        }}
                                                        title={(part.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar al carrito mayorista'}
                                                    >
                                                        🛒 + Mayor
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setSelectedPartForSale(part)}
                                                            disabled={(part.stock ?? 0) <= 0}
                                                            className="primary"
                                                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                                        >
                                                            Vender
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedPartForEdit(part)}
                                                            style={{ backgroundColor: '#6366f1', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                        >
                                                            Modificar
                                                        </button>
                                                        <button
                                                            className="danger"
                                                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                                            onClick={() => handleDelete(part.id)}
                                                        >
                                                            Eliminar
                                                        </button>
                                                        <button
                                                            onClick={() => { setStockMode('add'); setSelectedPartForRestock(part); }}
                                                            style={{ backgroundColor: '#10b981', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                        >
                                                            + Stock
                                                        </button>
                                                        <button
                                                            onClick={() => { setStockMode('remove'); setSelectedPartForRestock(part); }}
                                                            style={{ backgroundColor: '#f43f5e', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                        >
                                                            - Stock
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedPartForKardex(part)}
                                                            style={{ backgroundColor: '#7c3aed', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                            title="Ver historial completo de movimientos"
                                                        >
                                                            📋 Kardex
                                                        </button>
                                                        <button
                                                            onClick={() => handleAddToOrder(part)}
                                                            style={{ backgroundColor: '#eab308', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                            title="Agregar a la lista de Pedidos"
                                                        >
                                                            📦 Pedido
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredParts.length > paginatedParts.length && (
                            <div className="glass-panel" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                padding: '1rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0.5rem',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                backgroundColor: 'rgba(30, 41, 59, 0.5)'
                            }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Mostrando <strong>{paginatedParts.length}</strong> de <strong>{filteredParts.length}</strong> productos
                                </span>
                                
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        onClick={() => setRenderLimit(prev => prev + 100)}
                                        style={{
                                            backgroundColor: 'var(--card-bg)',
                                            color: 'var(--text-primary)',
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '0.375rem',
                                            fontWeight: '500'
                                        }}
                                    >
                                        ⬇️ Mostrar 100 más
                                    </button>
                                    <button
                                        onClick={() => setRenderLimit(filteredParts.length)}
                                        style={{
                                            backgroundColor: '#6366f1',
                                            color: 'white',
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        ✨ Mostrar todos ({filteredParts.length})
                                    </button>
                                </div>
                            </div>
                        )}
                        {filteredParts.length <= paginatedParts.length && filteredParts.length > 0 && (
                            <div style={{
                                textAlign: 'center',
                                marginTop: '1.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem'
                            }}>
                                Mostrando las <strong>{filteredParts.length}</strong> coincidencias encontradas en la misma página.
                            </div>
                        )}
                        {filteredParts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed #334155' }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>No se encontraron repuestos.</p>
                                <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>Usa "Carga Masiva" para importar productos desde Excel, o registra uno nuevo.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            <button
                onClick={scrollToSearch}
                className="fab"
                title="Nueva Búsqueda"
            >
                🔍
            </button>
        </div >
    );
}
