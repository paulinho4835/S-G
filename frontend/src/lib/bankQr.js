import { supabase } from './supabase';

// Cobro con QR dinámico de Banco Económico (Edge Function `bank-qr`, migración 20261007120000_bank_qr).
// Las credenciales del banco nunca pasan por aquí de vuelta: solo se envían al configurarlas.

async function bankQr(action, body = {}) {
    const { data, error } = await supabase.functions.invoke('bank-qr', { body: { action, ...body } });
    if (error) {
        // La función responde 400 con { error } y supabase-js lo envuelve: se rescata el mensaje real.
        let message = error.message;
        try {
            const detail = await error.context?.json();
            if (detail?.error) message = detail.error;
        } catch {
            // Sin cuerpo legible: queda el mensaje genérico.
        }
        throw new Error(message || 'No se pudo comunicar con el banco.');
    }
    if (data?.error) throw new Error(String(data.error));
    return data;
}

const normalize = (payment) => ({ ...payment, amount: Number(payment.amount) });

/** Lo que la pantalla puede mostrar de la conexión (sin secretos). */
export async function getBankQrProvider() {
    const { data, error } = await supabase.rpc('get_payment_provider');
    if (error) throw new Error(error.message);
    return data ?? { configured: false };
}

/**
 * ¿Se cobra con el QR del banco? Si la migración aún no está aplicada o algo falla, devuelve false y
 * la venta sigue con el QR fijo de siempre.
 */
export async function isBankQrEnabled() {
    try {
        const provider = await getBankQrProvider();
        return Boolean(provider.configured && provider.enabled);
    } catch {
        return false;
    }
}

/** Cifra la contraseña y la cuenta con el banco, comprueba que las acepta y recién las guarda. */
export const configureBankQr = (credentials) => bankQr('configure', credentials);
export const verifyBankQr = () => bankQr('verify');
export const setBankQrEnabled = (enabled) => bankQr('set-enabled', { enabled });
export const removeBankQr = () => bankQr('remove');

/**
 * Pide el QR al banco. `charge` es { kind: 'sale' | 'wholesale', payload } para una venta (el servidor
 * calcula el monto y registra la venta al confirmarse el pago) o { amount } para un cobro de prueba.
 */
export const generateBankQr = (charge) => bankQr('generate', charge);

export async function checkBankQr(paymentId) {
    return normalize((await bankQr('check', { paymentId })).payment);
}

export async function cancelBankQr(paymentId) {
    return normalize((await bankQr('cancel', { paymentId })).payment);
}
