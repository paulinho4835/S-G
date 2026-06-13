import React, { useState, useEffect } from 'react';
import PartForm from './components/PartForm';
import PartList from './components/PartList';
import SalesHistory from './components/SalesHistory';
import BulkUpload from './components/BulkUpload';
import Dashboard from './components/Dashboard';
import DatabaseMaintenance from './components/DatabaseMaintenance';
import OrdersList from './components/OrdersList';
import Login from './components/Login';
import WholesaleCart from './components/WholesaleCart';
import WholesaleHistory from './components/WholesaleHistory';
import QuotationsList from './components/QuotationsList';
import { toast } from './lib/toast';
import { supabase } from './lib/supabase';

function App() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [view, setView] = useState('register');
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);

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
        toast.success(`✅ "${part.codigo_producto || part.name}" agregado al carrito mayorista`);
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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

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
            if (rootEl && rootEl.scrollTop > 200) {
                setShowScrollBtn(true);
            } else if (window.scrollY > 200) {
                setShowScrollBtn(true);
            } else {
                setShowScrollBtn(false);
            }
        };

        if (rootEl) {
            rootEl.addEventListener('scroll', handleScroll);
        }
        window.addEventListener('scroll', handleScroll);

        return () => {
            if (rootEl) {
                rootEl.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollToTop = () => {
        const rootEl = document.getElementById('root');
        if (rootEl) {
            rootEl.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePartAdded = () => {
        setRefreshKey(prev => prev + 1);
        toast.success('Producto registrado correctamente');
        setView('products');
    };

    const handleAlertClick = () => {
        setView('products');
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    if (authLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}>Cargando...</div>;
    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    return (
        <>
            <header className="app-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
                    <h1 style={{ margin: 0 }}>La casa de los retenes S&G</h1>
                    <button 
                        onClick={() => {
                            supabase.auth.signOut();
                            setIsAuthenticated(false);
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cerrar Sesión
                    </button>
                </div>
                <nav className="nav-tabs">
                    <button
                        className={view === 'register' ? 'active' : ''}
                        onClick={() => setView('register')}
                    >
                        Registrar
                    </button>
                    <button
                        className={view === 'products' ? 'active' : ''}
                        onClick={() => setView('products')}
                    >
                        Productos
                    </button>
                    <button
                        className={view === 'sales' ? 'active' : ''}
                        onClick={() => setView('sales')}
                    >
                        Ventas del dia
                    </button>
                    <button
                        className={view === 'dashboard' ? 'active' : ''}
                        onClick={() => setView('dashboard')}
                    >
                        Dashboard
                    </button>
                    <button
                        className={view === 'orders' ? 'active' : ''}
                        onClick={() => setView('orders')}
                    >
                        Pedidos
                    </button>
                    <button
                        className={view === 'wholesale' ? 'active' : ''}
                        onClick={() => setView('wholesale')}
                        style={{ color: view === 'wholesale' ? undefined : '#f59e0b' }}
                    >
                        🛒 Mayorista{cartItems.length > 0 ? ` (${cartItems.length})` : ''}
                    </button>
                    <button
                        className={view === 'wholesale-history' ? 'active' : ''}
                        onClick={() => setView('wholesale-history')}
                    >
                        Hist. Mayorista
                    </button>
                    <button
                        className={view === 'quotations' ? 'active' : ''}
                        onClick={() => setView('quotations')}
                        style={{ color: view === 'quotations' ? undefined : '#3b82f6' }}
                    >
                        📋 Cotizaciones
                    </button>
                    <button
                        className={view === 'maintenance' ? 'active' : ''}
                        onClick={() => setView('maintenance')}
                    >
                        Mantenimiento
                    </button>
                </nav>
            </header>

            <main style={{ transition: 'margin-right 0.3s', marginRight: cartOpen && cartItems.length > 0 ? '430px' : 0 }}>
                {view === 'register' && (
                    <>
                        <BulkUpload onUploadComplete={handlePartAdded} />
                        <PartForm onPartAdded={handlePartAdded} />
                    </>
                )}

                {view === 'products' && (
                    <PartList refreshTrigger={refreshKey} onAddToWholesaleCart={handleAddToCart} />
                )}

                {view === 'sales' && (
                    <SalesHistory />
                )}

                {view === 'dashboard' && (
                    <Dashboard onAlertClick={handleAlertClick} />
                )}

                {view === 'orders' && (
                    <OrdersList />
                )}

                {view === 'wholesale' && (
                    <PartList refreshTrigger={refreshKey} onAddToWholesaleCart={handleAddToCart} />
                )}

                {view === 'wholesale-history' && (
                    <WholesaleHistory />
                )}

                {view === 'quotations' && (
                    <QuotationsList />
                )}

                {view === 'maintenance' && (
                    <DatabaseMaintenance />
                )}
            </main>

            {cartItems.length > 0 && (
                <>
                    <button
                        onClick={() => setCartOpen(o => !o)}
                        style={{
                            position: 'fixed',
                            bottom: '20px',
                            right: '20px',
                            zIndex: 300,
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: '#f59e0b',
                            color: '#0f172a',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            boxShadow: '0 6px 20px rgba(245,158,11,0.5)'
                        }}
                        title="Abrir/Cerrar Carrito Mayorista"
                    >
                        🛒 {cartItems.length}
                    </button>
                    {cartOpen && (
                        <>
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                width: '420px',
                                maxWidth: '95vw',
                                height: '100vh',
                                zIndex: 260,
                                boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
                                backgroundColor: 'var(--card-bg)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <button
                                    onClick={() => setCartOpen(false)}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        zIndex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#f87171',
                                        fontSize: '1.2rem',
                                        cursor: 'pointer',
                                        padding: '4px 10px'
                                    }}
                                    title="Cerrar"
                                >
                                    ✕
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
                        </>
                    )}
                </>
            )}

            {showScrollBtn && (
                <button
                    onClick={scrollToTop}
                    className="scroll-to-top-btn"
                    title="Volver Arriba"
                >
                    ⬆️
                </button>
            )}
        </>
    );
}

export default App;
