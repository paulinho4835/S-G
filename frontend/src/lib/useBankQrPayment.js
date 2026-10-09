import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelBankQr, checkBankQr, generateBankQr } from './bankQr';

const POLL_MS = 4000;
/** Pasado este tiempo sin pago se deja de consultar solo; queda el botón «Consultar pago». */
const GIVE_UP_MS = 10 * 60 * 1000;

/**
 * Un cobro con QR del banco: lo genera, consulta cada 4 s (solo con la pestaña visible) hasta que se
 * paga o se anula, y permite anularlo.
 */
export function useBankQrPayment() {
    const [qr, setQr] = useState(null);
    const [payment, setPayment] = useState(null);
    const [busy, setBusy] = useState(null); // 'generate' | 'check' | 'cancel' | null
    const [error, setError] = useState(null);
    const [waiting, setWaiting] = useState(false);
    const startedAt = useRef(0);
    const current = useRef(null);

    const reset = useCallback(() => {
        current.current = null;
        setQr(null);
        setPayment(null);
        setWaiting(false);
        setError(null);
    }, []);

    const generate = useCallback(async (charge) => {
        setBusy('generate');
        setError(null);
        setPayment(null);
        try {
            const generated = await generateBankQr(charge);
            current.current = generated.paymentId;
            startedAt.current = Date.now();
            setQr(generated);
            setWaiting(true);
            return generated;
        } catch (reason) {
            setError(reason.message || 'No se pudo generar el QR.');
            return null;
        } finally {
            setBusy(null);
        }
    }, []);

    const check = useCallback(async (quiet = false) => {
        const paymentId = current.current;
        if (!paymentId) return null;
        if (!quiet) setBusy('check');
        try {
            const next = await checkBankQr(paymentId);
            if (current.current !== paymentId) return null;
            setPayment(next);
            if (next.status !== 'pending') setWaiting(false);
            if (!quiet) setError(null);
            return next;
        } catch (reason) {
            // Una consulta automática fallida no corta la espera; una manual muestra el motivo.
            if (!quiet) setError(reason.message || 'No se pudo consultar el QR.');
            return null;
        } finally {
            if (!quiet) setBusy(null);
        }
    }, []);

    const cancel = useCallback(async () => {
        const paymentId = current.current;
        if (!paymentId) return null;
        setBusy('cancel');
        setError(null);
        try {
            const next = await cancelBankQr(paymentId);
            setPayment(next);
            setWaiting(false);
            return next;
        } catch (reason) {
            setError(reason.message || 'No se pudo anular el QR.');
            return null;
        } finally {
            setBusy(null);
        }
    }, []);

    useEffect(() => {
        if (!waiting) return;
        let stopped = false;
        let timer;
        const tick = async () => {
            if (stopped) return;
            if (Date.now() - startedAt.current > GIVE_UP_MS) {
                setWaiting(false);
                return;
            }
            if (document.visibilityState === 'visible') await check(true);
            if (!stopped) timer = setTimeout(tick, POLL_MS);
        };
        timer = setTimeout(tick, POLL_MS);
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [check, waiting]);

    const status = payment?.status ?? (qr ? 'pending' : null);
    return { qr, payment, status, waiting, busy, error, generate, check, cancel, reset };
}
