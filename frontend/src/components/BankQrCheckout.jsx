import React, { useEffect, useRef } from 'react';
import { useBankQrPayment } from '../lib/useBankQrPayment';

const money = (value) => `Bs. ${Number(value || 0).toFixed(2)}`;

/** Un "ding" corto para que el vendedor escuche el pago sin mirar la pantalla. */
function playPaidSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        [880, 1320].forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const start = context.currentTime + index * 0.14;
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.32);
        });
        window.setTimeout(() => context.close(), 1000);
    } catch {
        // Sin sonido: la pantalla igual muestra el pago.
    }
}

/**
 * Cobro con el QR dinámico del banco: pide un QR por el monto exacto, espera el pago y el servidor
 * registra la venta recién cuando el banco lo confirma.
 *
 * - `charge`: { kind: 'sale' | 'wholesale', payload } (lo que se registra al pagarse).
 * - `onRegistered(payment)`: la venta quedó registrada (refrescar listas, vaciar carrito…).
 * - `onCancelled()`: el QR se anuló o no se pudo generar; volver a elegir cómo cobrar.
 * - `onClose()`: cerrar después del pago.
 */
export default function BankQrCheckout({ charge, onRegistered, onCancelled, onClose }) {
    const qrPayment = useBankQrPayment();
    const started = useRef(false);
    const notified = useRef(false);
    const payment = qrPayment.payment;
    const registered = Boolean(payment?.registered_at);

    const generate = () => qrPayment.generate(charge);

    useEffect(() => {
        // Una sola vez por cobro, también con los efectos dobles de React en desarrollo.
        if (started.current) return;
        started.current = true;
        generate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!registered || notified.current) return;
        notified.current = true;
        playPaidSound();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registered]);

    const finish = () => {
        onRegistered(payment);
        onClose();
    };

    useEffect(() => {
        if (qrPayment.status === 'cancelled') onCancelled();
    }, [qrPayment.status, onCancelled]);

    let content;
    if (qrPayment.status === 'paid') {
        content = (
            <div style={styles.center} role="status" aria-live="assertive">
                <div style={styles.check} aria-hidden="true">✓</div>
                <h3 style={{ margin: '0.25rem 0' }}>Pago recibido</h3>
                <strong style={styles.amount}>{money(payment?.amount)}</strong>
                {payment?.payer_name && <p style={styles.muted}>Pagado por {payment.payer_name}</p>}
                {payment?.bank_transaction_id && (
                    <small style={styles.muted}>Transacción {payment.bank_transaction_id}</small>
                )}
                {registered ? (
                    <>
                        <p style={{ color: '#4ade80', margin: '0.75rem 0' }}>
                            {payment.wholesale_order_id
                                ? `Venta por mayor #${payment.wholesale_order_id} registrada.`
                                : `Venta #${payment.sale_id} registrada.`}
                        </p>
                        <button type="button" className="primary" onClick={finish}>Listo</button>
                    </>
                ) : (
                    <>
                        <p style={styles.error} role="alert">
                            El pago se recibió, pero la venta NO se registró
                            {payment?.register_error ? `: ${payment.register_error}` : '.'}
                        </p>
                        {qrPayment.error && <p style={styles.error}>{qrPayment.error}</p>}
                        <button
                            type="button"
                            className="primary"
                            disabled={qrPayment.busy !== null}
                            onClick={() => qrPayment.check()}
                        >
                            {qrPayment.busy === 'check' ? 'Registrando…' : 'Reintentar registrar la venta'}
                        </button>
                    </>
                )}
            </div>
        );
    } else if (!qrPayment.qr) {
        content = qrPayment.error ? (
            <div style={styles.center}>
                <p style={styles.error} role="alert">{qrPayment.error}</p>
                <div style={styles.actions}>
                    <button type="button" style={styles.secondary} onClick={onCancelled}>Volver</button>
                    <button type="button" className="primary" disabled={qrPayment.busy !== null} onClick={generate}>
                        Reintentar
                    </button>
                </div>
            </div>
        ) : (
            <p style={{ ...styles.muted, textAlign: 'center' }} role="status">Generando el QR de cobro…</p>
        );
    } else {
        content = (
            <div style={styles.center}>
                <img
                    src={`data:image/png;base64,${qrPayment.qr.qrImage}`}
                    alt={`QR de cobro por ${money(qrPayment.qr.amount)}`}
                    style={styles.qr}
                />
                <strong style={styles.amount}>{money(qrPayment.qr.amount)}</strong>
                <p style={styles.muted} role="status">
                    {qrPayment.waiting
                        ? '⏳ Esperando el pago… muestra este QR al cliente.'
                        : 'Ya no se consulta solo. Usa «Consultar pago» o anula el cobro.'}
                </p>
                {qrPayment.error && <p style={styles.error} role="alert">{qrPayment.error}</p>}
                {/* Si el cliente pagó justo antes de anular, el banco lo dice y se registra la venta. */}
                <div style={styles.actions}>
                    <button
                        type="button"
                        style={styles.secondary}
                        disabled={qrPayment.busy !== null}
                        onClick={() => qrPayment.cancel()}
                    >
                        {qrPayment.busy === 'cancel' ? 'Anulando…' : 'Anular cobro'}
                    </button>
                    <button
                        type="button"
                        className="primary"
                        disabled={qrPayment.busy !== null}
                        onClick={() => qrPayment.check()}
                    >
                        {qrPayment.busy === 'check' ? 'Consultando…' : 'Consultar pago'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.overlay}>
            <div className="glass-panel" style={styles.panel}>
                <h3 style={{ marginTop: 0, textAlign: 'center' }}>📱 Cobro con QR del banco</h3>
                {content}
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000,
    },
    panel: { width: '380px', maxWidth: '92%' },
    center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', textAlign: 'center' },
    qr: { width: '260px', maxWidth: '100%', background: '#fff', padding: '8px', borderRadius: '8px' },
    amount: { fontSize: '1.6rem', color: 'var(--accent-color)' },
    muted: { color: 'var(--text-secondary)', margin: '0.25rem 0', fontSize: '0.9rem' },
    error: { color: '#fca5a5', margin: '0.5rem 0', fontSize: '0.9rem' },
    check: {
        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(74, 222, 128, 0.15)',
        color: '#4ade80', fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    actions: { display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.75rem' },
    secondary: { backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555' },
};
