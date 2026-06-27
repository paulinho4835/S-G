import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Aviso visible cuando se pierde la conexión a internet.
 * Evita registrar ventas creyendo que se guardaron cuando no hay red.
 * Muestra un banner rojo fijo al perder conexión y un breve verde al volver.
 */
export default function OfflineBanner() {
    const [online, setOnline] = useState(navigator.onLine);
    const [justReconnected, setJustReconnected] = useState(false);

    useEffect(() => {
        const goOffline = () => { setOnline(false); setJustReconnected(false); };
        const goOnline = () => {
            setOnline(true);
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3000);
        };
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (online && !justReconnected) return null;

    const offline = !online;
    return (
        <div
            role="status"
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                zIndex: 500000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '7px 12px',
                fontSize: '0.82rem', fontWeight: 700,
                color: '#fff',
                background: offline ? '#b91c1c' : '#14965a',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                animation: 'slide-down 0.25s ease-out',
            }}
        >
            {offline
                ? <><WifiOff size={15} /> Sin conexión a internet — los cambios no se guardarán hasta reconectar</>
                : <><Wifi size={15} /> Conexión restablecida</>}
        </div>
    );
}
