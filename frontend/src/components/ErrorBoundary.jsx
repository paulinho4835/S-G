import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Red de seguridad: si una vista lanza un error (o un chunk lazy no carga
 * por mala conexión), muestra un aviso recuperable en vez de pantalla blanca.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Log para depuración (queda en la consola de Electron)
        console.error('ErrorBoundary capturó un error:', error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) this.props.onReset();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '1rem', padding: '3rem 1.5rem', textAlign: 'center',
                minHeight: '50vh', color: 'var(--text-secondary)'
            }}>
                <AlertTriangle size={48} color="#f59e0b" strokeWidth={1.5} />
                <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Algo salió mal en esta vista</h2>
                <p style={{ margin: 0, maxWidth: '420px', fontSize: '0.9rem' }}>
                    Ocurrió un error inesperado. Tus datos están a salvo. Puedes reintentar
                    o cambiar de sección desde el menú.
                </p>
                {this.state.error?.message && (
                    <code style={{
                        fontSize: '0.78rem', color: '#f87171', background: 'rgba(196,53,53,0.1)',
                        padding: '0.4rem 0.7rem', borderRadius: '6px', maxWidth: '90%',
                        overflowWrap: 'anywhere', fontFamily: 'var(--font-mono)'
                    }}>
                        {this.state.error.message}
                    </code>
                )}
                <button
                    onClick={this.handleReset}
                    className="primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                    <RefreshCw size={15} /> Reintentar
                </button>
            </div>
        );
    }
}
