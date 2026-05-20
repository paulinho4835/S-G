import React, { useState } from 'react';
import { toast } from '../lib/toast';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (username === 'pochita' && password === 'pochita') {
            onLogin();
            toast.success('¡Bienvenido!');
        } else {
            toast.error('Credenciales incorrectas');
        }
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
                    <h1 style={{ fontSize: '1.8rem', color: '#f8fafc', marginBottom: '0.5rem', marginTop: 0 }}>La Casa de los Retenes S&G</h1>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Inicia sesión para continuar</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Ingrese su usuario"
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
                            placeholder="Ingrese su contraseña"
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
                        style={{
                            marginTop: '0.5rem',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            backgroundColor: '#3b82f6'
                        }}
                    >
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}
