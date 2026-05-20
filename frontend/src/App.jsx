import React, { useState, useEffect } from 'react';
import PartForm from './components/PartForm';
import PartList from './components/PartList';
import SalesHistory from './components/SalesHistory';
import BulkUpload from './components/BulkUpload';
import Dashboard from './components/Dashboard';
import DatabaseMaintenance from './components/DatabaseMaintenance';
import OrdersList from './components/OrdersList';
import Login from './components/Login';
import { toast } from './lib/toast';

function App() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [view, setView] = useState('register');
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('auth_token') === 'pochita';
    });

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
        localStorage.setItem('auth_token', 'pochita');
        setIsAuthenticated(true);
    };

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <>
            <header className="app-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
                    <h1 style={{ margin: 0 }}>La casa de los retenes S&G</h1>
                    <button 
                        onClick={() => {
                            localStorage.removeItem('auth_token');
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
                        className={view === 'maintenance' ? 'active' : ''}
                        onClick={() => setView('maintenance')}
                    >
                        Mantenimiento
                    </button>
                </nav>
            </header>

            <main>
                {view === 'register' && (
                    <>
                        <BulkUpload onUploadComplete={handlePartAdded} />
                        <PartForm onPartAdded={handlePartAdded} />
                    </>
                )}

                {view === 'products' && (
                    <PartList refreshTrigger={refreshKey} />
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

                {view === 'maintenance' && (
                    <DatabaseMaintenance />
                )}
            </main>

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
