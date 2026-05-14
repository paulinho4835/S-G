import React, { useState } from 'react';
import PartForm from './components/PartForm';
import PartList from './components/PartList';
import SalesHistory from './components/SalesHistory';
import BulkUpload from './components/BulkUpload';
import Dashboard from './components/Dashboard';

function App() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [view, setView] = useState('register');

    const handlePartAdded = () => {
        setRefreshKey(prev => prev + 1);
        if (confirm("Producto registrado. ¿Ir a la lista de productos?")) {
            setView('products');
        }
    };

    const handleAlertClick = () => {
        setView('products');
    };

    return (
        <>
            <header className="app-header">
                <div>
                    <h1>La casa de los retenes S&G</h1>
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
                        Historial Ventas
                    </button>
                    <button
                        className={view === 'dashboard' ? 'active' : ''}
                        onClick={() => setView('dashboard')}
                    >
                        Dashboard
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
            </main>
        </>
    );
}

export default App;
