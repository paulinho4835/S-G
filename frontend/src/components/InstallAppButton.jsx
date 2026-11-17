import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallAppButton() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [installed, setInstalled] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        const displayMode = window.matchMedia('(display-mode: standalone)');
        const syncInstalledState = () => {
            setInstalled(displayMode.matches || navigator.standalone === true);
        };
        const captureInstallPrompt = (event) => {
            event.preventDefault();
            setInstallPrompt(event);
        };
        const markInstalled = () => {
            setInstalled(true);
            setInstallPrompt(null);
        };

        syncInstalledState();
        displayMode.addEventListener?.('change', syncInstalledState);
        window.addEventListener('beforeinstallprompt', captureInstallPrompt);
        window.addEventListener('appinstalled', markInstalled);

        return () => {
            displayMode.removeEventListener?.('change', syncInstalledState);
            window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
            window.removeEventListener('appinstalled', markInstalled);
        };
    }, []);

    useEffect(() => {
        if (!showInstructions) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setShowInstructions(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [showInstructions]);

    const handleInstall = async () => {
        if (!installPrompt) {
            setShowInstructions(true);
            return;
        }

        try {
            const prompt = installPrompt;
            await prompt.prompt();
            const choice = await prompt.userChoice;
            setInstallPrompt(null);
            if (choice.outcome === 'accepted') setInstalled(true);
        } catch {
            setInstallPrompt(null);
            setShowInstructions(true);
        }
    };

    if (installed) return null;

    const userAgent = navigator.userAgent.toLowerCase();
    const isAppleMobile = /iphone|ipad|ipod/.test(userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return (
        <>
            <button
                type="button"
                className="pwa-install-button"
                onClick={handleInstall}
                aria-haspopup="dialog"
                title="Instalar Felipillo en este dispositivo"
            >
                <Download size={15} aria-hidden="true" />
                <span>Instalar app</span>
            </button>

            {showInstructions && (
                <div className="pwa-install-overlay" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowInstructions(false);
                }}>
                    <section
                        className="pwa-install-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pwa-install-title"
                    >
                        <button
                            type="button"
                            className="pwa-install-close"
                            onClick={() => setShowInstructions(false)}
                            aria-label="Cerrar instrucciones"
                        >
                            <X size={18} />
                        </button>
                        <div className="pwa-install-dialog-icon" aria-hidden="true">
                            <Download size={22} />
                        </div>
                        <h2 id="pwa-install-title">Instala Felipillo en tu celular</h2>
                        {isAppleMobile ? (
                            <p>En Safari, toca <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>.</p>
                        ) : (
                            <p>Abre el menú del navegador <strong>⋮</strong> y toca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla principal</strong>.</p>
                        )}
                        <p className="pwa-install-note">Después podrás abrir Felipillo desde el ícono, como cualquier otra aplicación.</p>
                    </section>
                </div>
            )}
        </>
    );
}
