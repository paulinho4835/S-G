import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            toast.error('Credenciales incorrectas');
        } else {
            toast.success('¡Bienvenido!');
            onLogin();
        }
        setLoading(false);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#f8fafc', marginBottom: '0.5rem', marginTop: 0 }}>La Casa de los Retenes S&amp;G</h1>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Inicia sesión para continuar</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@retenes.app"
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #334155',
                                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                color: '#f8fafc',
                                fontSize: '1rem',
                                boxSizing: 'border-box'
                            }}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #334155',
                                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                color: '#f8fafc',
                                fontSize: '1rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        className="primary"
                        disabled={loading}
                        style={{
                            marginTop: '0.5rem',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            backgroundColor: '#3b82f6'
                        }}
                    >
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
