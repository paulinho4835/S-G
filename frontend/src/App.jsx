import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
    FilePlus, Package, Receipt, LayoutDashboard, Truck,
    Store, History, FileText, Wrench, LogOut,
    ShoppingCart, ArrowUp, X, Menu
} from 'lucide-react';
import Login from './components/Login';
import WholesaleCart from './components/WholesaleCart';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import { toast } from './lib/toast';
import { supabase } from './lib/supabase';

// Vistas con carga diferida (code-splitting) — solo se descargan al abrirlas.
const PartForm           = lazy(() => import('./components/PartForm'));
const PartList           = lazy(() => import('./components/PartList'));
const SalesHistory       = lazy(() => import('./components/SalesHistory'));
const BulkUpload         = lazy(() => import('./components/BulkUpload'));
const Dashboard          = lazy(() => import('./components/Dashboard'));
const DatabaseMaintenance = lazy(() => import('./components/DatabaseMaintenance'));
const OrdersList         = lazy(() => import('./components/OrdersList'));
const WholesaleHistory   = lazy(() => import('./components/WholesaleHistory'));
const QuotationsList     = lazy(() => import('./components/QuotationsList'));

const NAV_ITEMS = [
    { view: 'register',          label: 'Registrar',      Icon: FilePlus },
    { view: 'products',          label: 'Productos',      Icon: Package },
    { view: 'sales',             label: 'Ventas',         Icon: Receipt },
    { view: 'dashboard',         label: 'Dashboard',      Icon: LayoutDashboard },
    { view: 'orders',            label: 'Pedidos',        Icon: Truck },
    { view: 'wholesale',         label: 'Mayorista',      Icon: Store,    cls: 'nav-amber' },
    { view: 'wholesale-history', label: 'Hist. Mayor',    Icon: History },
    { view: 'quotations',        label: 'Cotizaciones',   Icon: FileText, cls: 'nav-blue' },
    { view: 'maintenance',       label: 'Mantenimiento',  Icon: Wrench },
];

function App() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [view, setView] = useState('register');
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    const handleAddToCart = (part) => {
        const cartKey = `${part.id}-${Date.now()}`;
        const existing = cartItems.find(i => i.id === part.id);
        if (existing) {
            toast.error(`"${part.codigo_producto || part.name}" ya está en el carrito.`);
            return;
        }
        setCartItems(prev => [...prev, {
            ...part,
            cartKey,
            quantity: 1,
            unit_price: part.pv_geli || part.cost_price || 0
        }]);
        toast.success(`"${part.codigo_producto || part.name}" agregado al carrito mayorista`);
        setCartOpen(true);
    };

    const handleUpdateCartItem = (cartKey, field, value) => {
        setCartItems(prev => prev.map(i => i.cartKey === cartKey ? { ...i, [field]: value } : i));
    };

    const handleRemoveCartItem = (cartKey) => {
        setCartItems(prev => prev.filter(i => i.cartKey !== cartKey));
    };

    const handleClearCart = () => setCartItems([]);

    const handleWholesaleComplete = () => {
        setRefreshKey(k => k + 1);
    };

    const handleQuoteComplete = () => {
        setCartOpen(false);
        setView('quotations');
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsAuthenticated(!!session);
            setAuthLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const rootEl = document.getElementById('root');
        const handleScroll = () => {
            const scrolled = (rootEl?.scrollTop ?? 0) > 200 || window.scrollY > 200;
            setShowScrollBtn(scrolled);
        };
        rootEl?.addEventListener('scroll', handleScroll);
        window.addEventListener('scroll', handleScroll);
        return () => {
            rootEl?.removeEventListener('scroll', handleScroll);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // ── Atajos de teclado (velocidad de mostrador) ──
    useEffect(() => {
        const onKey = (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

            // Esc: cierra carrito/menú o sale del campo activo
            if (e.key === 'Escape') {
                setCartOpen(false);
                setMenuOpen(false);
                if (typing) e.target.blur();
                return;
            }

            if (typing) return; // no interceptar mientras se escribe

            // "/" → ir a Productos y enfocar la búsqueda
            if (e.key === '/') {
                e.preventDefault();
                setView('products');
                setTimeout(() => window.dispatchEvent(new Event('focus-product-search')), 60);
                return;
            }

            // Alt + 1..9 → cambiar de sección
            if (e.altKey && /^[1-9]$/.test(e.key)) {
                const item = NAV_ITEMS[parseInt(e.key, 10) - 1];
                if (item) { e.preventDefault(); setView(item.view); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const scrollToTop = () => {
        document.getElementById('root')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePartAdded = () => {
        setRefreshKey(prev => prev + 1);
        toast.success('Producto registrado correctamente');
        setView('products');
    };

    const handleAlertClick = () => setView('products');
    const handleLogin = () => setIsAuthenticated(true);

    if (authLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#4e6a88', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
                Cargando...
            </div>
        );
    }

    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    return (
        <>
            <OfflineBanner />
            {/* ── Header ── */}
            <header className="app-header">
                <div className="app-header-top">
                    <div className="app-brand">
                        <h1>La casa de los retenes S&amp;G</h1>
                    </div>
                    <div className="app-header-actions">
                        <button
                            className="nav-toggle"
                            onClick={() => setMenuOpen(o => !o)}
                            title={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                            aria-label="Menú"
                        >
                            {menuOpen ? <X size={20} /> : <Menu size={20} />}
                            {!menuOpen && cartItems.length > 0 && <span className="nav-badge">{cartItems.length}</span>}
                        </button>
                        <button
                            className="btn-logout"
                            onClick={() => {
                                supabase.auth.signOut();
                                setIsAuthenticated(false);
                            }}
                        >
                            <LogOut size={13} />
                            Salir
                        </button>
                    </div>
                </div>

                <nav className={`nav-tabs${menuOpen ? ' open' : ''}`}>
                    {NAV_ITEMS.map(({ view: v, label, Icon, cls }, i) => (
                        <button
                            key={v}
                            className={[view === v ? 'active' : '', cls || ''].filter(Boolean).join(' ')}
                            onClick={() => { setView(v); setMenuOpen(false); }}
                            title={i < 9 ? `${label} (Alt+${i + 1})` : label}
                        >
                            <Icon size={14} strokeWidth={2} />
                            {label}
                            {v === 'wholesale' && cartItems.length > 0 && (
                                <span className="nav-badge">{cartItems.length}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </header>

            {/* ── Contenido principal ── */}
            <main
                className="app-main"
                style={{ transition: 'margin-right 0.3s', marginRight: cartOpen && cartItems.length > 0 ? '430px' : 0 }}
            >
                <ErrorBoundary key={view} onReset={() => setRefreshKey(k => k + 1)}>
                <Suspense fallback={<div className="loading-container"><div className="spinner" /><p>Cargando módulo...</p></div>}>
                {view === 'register' && (
                    <>
                        <BulkUpload onUploadComplete={handlePartAdded} />
                        <PartForm onPartAdded={handlePartAdded} />
                    </>
                )}
                {view === 'products' && (
                    <PartList refreshTrigger={refreshKey} onAddToWholesaleCart={handleAddToCart} />
                )}
                {view === 'sales' && <SalesHistory />}
                {view === 'dashboard' && <Dashboard onAlertClick={handleAlertClick} />}
                {view === 'orders' && <OrdersList />}
                {view === 'wholesale' && (
                    <PartList refreshTrigger={refreshKey} onAddToWholesaleCart={handleAddToCart} />
                )}
                {view === 'wholesale-history' && <WholesaleHistory />}
                {view === 'quotations' && <QuotationsList />}
                {view === 'maintenance' && <DatabaseMaintenance />}
                </Suspense>
                </ErrorBoundary>
            </main>

            {/* ── Carrito mayorista ── */}
            {cartItems.length > 0 && (
                <>
                    <button
                        onClick={() => setCartOpen(o => !o)}
                        className="fab"
                        title="Abrir/Cerrar Carrito Mayorista"
                        style={{ bottom: '2rem', right: '2rem' }}
                    >
                        <ShoppingCart size={22} strokeWidth={2.2} />
                        {cartItems.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-4px',
                                background: '#fff', color: '#07111e',
                                fontSize: '0.62rem', fontWeight: '800',
                                width: '18px', height: '18px',
                                borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'JetBrains Mono, monospace'
                            }}>
                                {cartItems.length}
                            </span>
                        )}
                    </button>

                    {cartOpen && (
                        <div style={{
                            position: 'fixed',
                            top: 0, right: 0,
                            width: '420px',
                            maxWidth: '95vw',
                            height: '100vh',
                            zIndex: 260,
                            boxShadow: '-8px 0 32px rgba(0,0,0,0.55)',
                            backgroundColor: 'var(--card-bg)',
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: '1px solid var(--border-color)'
                        }}>
                            <button
                                onClick={() => setCartOpen(false)}
                                style={{
                                    position: 'absolute',
                                    top: '10px', right: '10px',
                                    zIndex: 1,
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '6px',
                                    width: '30px', height: '30px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                                title="Cerrar"
                            >
                                <X size={15} />
                            </button>
                            <WholesaleCart
                                cartItems={cartItems}
                                onUpdateItem={handleUpdateCartItem}
                                onRemoveItem={handleRemoveCartItem}
                                onClearCart={handleClearCart}
                                onOrderComplete={handleWholesaleComplete}
                                onQuoteComplete={handleQuoteComplete}
                            />
                        </div>
                    )}
                </>
            )}

            {/* ── Scroll to top ── */}
            {showScrollBtn && (
                <button
                    onClick={scrollToTop}
                    className="scroll-to-top-btn"
                    title="Volver arriba"
                >
                    <ArrowUp size={18} />
                </button>
            )}
        </>
    );
}

export default App;
