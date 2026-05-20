/**
 * Toast — notificaciones no bloqueantes sin alert() ni confirm().
 * No afecta el foco del cursor en Electron/Windows.
 */
const CONTAINER_ID = 'sg-toast-container';

function getContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = CONTAINER_ID;
        Object.assign(el.style, {
            position: 'fixed',
            top: '1.25rem',
            right: '1.25rem',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            pointerEvents: 'none',
        });
        document.body.appendChild(el);
    }
    return el;
}

function show(message, type, duration = 3500) {
    const cfg = {
        success: { bg: 'rgba(6,78,59,0.97)',  border: '#10b981', icon: '✅', color: '#34d399' },
        error:   { bg: 'rgba(69,10,10,0.97)',  border: '#ef4444', icon: '❌', color: '#fca5a5' },
        warning: { bg: 'rgba(66,32,6,0.97)',   border: '#f97316', icon: '⚠️', color: '#fdba74' },
        info:    { bg: 'rgba(12,35,64,0.97)',  border: '#38bdf8', icon: 'ℹ️', color: '#7dd3fc' },
    };
    const c = cfg[type] || cfg.info;
    const el = document.createElement('div');
    Object.assign(el.style, {
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: '0.75rem 1.1rem',
        borderRadius: '0.7rem',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '0.9rem',
        fontWeight: '500',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'auto',
        minWidth: '260px',
        maxWidth: '420px',
        opacity: '0',
        transform: 'translateX(16px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
    });
    el.innerHTML = `<span style="font-size:1.05rem;flex-shrink:0">${c.icon}</span><span>${message}</span>`;
    getContainer().appendChild(el);
    // Animate in
    requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(0)';
    }));
    // Auto-remove
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(16px)';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

export const toast = {
    success: (msg, ms) => show(msg, 'success', ms),
    error:   (msg, ms) => show(msg, 'error', ms),
    warning: (msg, ms) => show(msg, 'warning', ms),
    info:    (msg, ms) => show(msg, 'info', ms),
};
