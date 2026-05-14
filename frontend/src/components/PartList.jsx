import React, { useEffect, useState, useMemo } from 'react';
import SalesModal from './SalesModal';
import EditPartModal from './EditPartModal';
import AdjustStockModal from './AdjustStockModal';


export default function PartList({ refreshTrigger }) {
    const [parts, setParts] = useState([]);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ internal: '', external: '', height: '' });
    const [selectedPartForSale, setSelectedPartForSale] = useState(null);
    const [selectedPartForEdit, setSelectedPartForEdit] = useState(null);
    const [selectedPartForRestock, setSelectedPartForRestock] = useState(null);
    const [stockMode, setStockMode] = useState('add'); // 'add' or 'remove'
    const [loading, setLoading] = useState(false);
    const [recentParts, setRecentParts] = useState(() => {
        const saved = localStorage.getItem('recentParts');
        return saved ? JSON.parse(saved) : [];
    });
    const internalInputRef = React.useRef(null);

    useEffect(() => {
        localStorage.setItem('recentParts', JSON.stringify(recentParts));
    }, [recentParts]);

    const toggleRecent = (part) => {
        setRecentParts(prev => {
            const exists = prev.find(p => p.id === part.id);
            if (exists) {
                return prev.filter(p => p.id !== part.id);
            } else {
                return [part, ...prev].slice(0, 5); // Keep last 5 for better UX
            }
        });
    };


    const fetchParts = async () => {
        // Only show loading spinner on initial load or if list is empty
        if (parts.length === 0) {
            setLoading(true);
        }

        try {
            const res = await fetch('/api/parts');
            const data = await res.json();
            if (data.message === 'success') {
                setParts(data.data);
            }
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
        return parts.filter(part => {
            // 1. General Search Filter
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesCode = part.codigo?.toLowerCase().includes(searchLower);
                const matchesName = (part.name || part.codigo_producto)?.toLowerCase().includes(searchLower);
                const matchesBrand = part.marca?.toLowerCase().includes(searchLower);
                const matchesApp = part.aplicacion?.toLowerCase().includes(searchLower);

                if (!matchesCode && !matchesName && !matchesBrand && !matchesApp) {
                    return false;
                }
            }

            // 2. Specific Dimension Filters
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
    }, [parts, search, filters]);

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
        try {
            const res = await fetch(`/api/parts/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (res.ok) {
                fetchParts();
            } else {
                alert(data.error || "No se pudo eliminar el producto.");
            }
        } catch (error) {
            console.error('Error deleting part:', error);
            alert("Error de conexión al intentar eliminar.");
        }
    };

    const handleConfirmSale = async (saleData) => {
        try {
            const res = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });
            const data = await res.json();
            if (data.message === 'success') {
                alert("Venta registrada correctamente");
                setSelectedPartForSale(null); // Close modal
                fetchParts(); // Refresh stock
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error("Error selling part:", error);
            alert("Error al procesar la venta. Verifica que el servidor backend esté corriendo y la base de datos esté actualizada.");
        }
    };

    const handleRestock = async (qty) => {
        const part = selectedPartForRestock;
        if (!part) return;

        try {
            const res = await fetch(`/api/parts/${part.id}/restock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: qty })
            });
            const data = await res.json();
            if (data.message === 'success') {
                alert("Stock actualizado");
                setSelectedPartForRestock(null);
                fetchParts();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error("Error restocking:", error);
            alert("Error al actualizar stock");
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleDownloadExcel = () => {
        window.location.href = '/api/parts/export';
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {recentParts.map(part => (
                            <div key={`recent-${part.id}`} className="card" style={{ padding: '0.8rem', position: 'relative' }}>
                                <button
                                    onClick={() => toggleRecent(part)}
                                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'transparent', color: '#f87171', padding: '4px' }}
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
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass-panel" style={{ marginBottom: '2rem', position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>📦 Lista de Productos</h2>
                    <button
                        onClick={handleDownloadExcel}
                        className="primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#059669',
                            padding: '0.6rem 1.2rem',
                            fontSize: '0.9rem'
                        }}
                    >
                        📥 Descargar Excel
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Búsqueda General</label>
                        <input
                            placeholder="Buscar por código, nombre, marca o aplicación..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Medida Interna</label>
                            <input
                                ref={internalInputRef}
                                name="internal"
                                placeholder="Ej. 25.4"
                                type="number"
                                step="0.01"
                                value={filters.internal}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Medida Externa</label>
                            <input name="external" placeholder="Ej. 38.07" type="number" step="0.01" value={filters.external} onChange={handleFilterChange} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Altura</label>
                            <input name="height" placeholder="Ej. 7.0" type="number" step="0.01" value={filters.height} onChange={handleFilterChange} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                onClick={handleReset}
                                className="danger"
                                style={{
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.85rem',
                                    width: '100%',
                                    backgroundColor: '#475569', // Discrete darker gray
                                    border: 'none'
                                }}
                            >
                                🧹 Limpiar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>

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

            <div style={{ overflowX: 'auto' }}>
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Cargando productos...</p>
                    </div>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--card-bg)', borderRadius: '8px', overflow: 'hidden' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #334155' }}>
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
                                {filteredParts.map(part => (
                                    <tr key={part.id} style={{ borderBottom: '1px solid #334155' }}>
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
                                            style={{ padding: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
                                            onDoubleClick={() => toggleRecent(part)}
                                            title="Doble clic para anclar a Recientes"
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
                                        <td style={{ padding: '8px', color: '#ec4899', fontSize: '0.85rem' }}>{part.pv_geli || '-'}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: (part.stock ?? 0) > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                color: (part.stock ?? 0) > 0 ? '#34d399' : '#f87171',
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
                                            <div style={{ display: 'flex', gap: '4px' }}>
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
                                                    onClick={() => {
                                                        setStockMode('add');
                                                        setSelectedPartForRestock(part);
                                                    }}
                                                    style={{ backgroundColor: '#10b981', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                >
                                                    + Stock
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setStockMode('remove');
                                                        setSelectedPartForRestock(part);
                                                    }}
                                                    style={{ backgroundColor: '#f43f5e', fontSize: '0.8rem', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', color: 'white' }}
                                                >
                                                    - Stock
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredParts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed #334155' }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>No se encontraron repuestos.</p>
                                <p style={{ marginBottom: '2rem' }}>Si es la primera vez que abres la app, es posible que la base de datos esté vacía.</p>
                                <button
                                    onClick={async () => {
                                        if (confirm("Esto intentará cargar los datos originales. ¿Proceder?")) {
                                            const res = await fetch('/api/admin/restore-db', { method: 'POST' });
                                            const data = await res.json();
                                            alert(data.message || data.error);
                                            window.location.reload();
                                        }
                                    }}
                                    className="primary"
                                    style={{ backgroundColor: '#6366f1' }}
                                >
                                    🔄 Sincronizar Datos de Fábrica
                                </button>
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
