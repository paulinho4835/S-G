import React, { useCallback, useEffect, useState } from 'react';
import { toast } from '../lib/toast';
import {
    configureBankQr,
    getBankQrProvider,
    removeBankQr,
    setBankQrEnabled,
    verifyBankQr,
} from '../lib/bankQr';
import { useBankQrPayment } from '../lib/useBankQrPayment';
import ConfirmDialog from './ConfirmDialog';

const environmentLabel = { certification: 'Certificación (pruebas)', production: 'Producción' };
const dateTime = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' });

const emptyForm = {
    environment: 'certification',
    username: '',
    password: '',
    aesKey: '',
    account: '',
    currency: 'BOB',
    branchCode: '',
};

/**
 * Conexión con Banco Económico (API Market) para cobrar con QR dinámico: el QR lleva el monto exacto
 * de la venta y el pago se confirma solo. Las credenciales se guardan cifradas y solo las usa el
 * servidor (Edge Function bank-qr).
 */
export default function BankQrSettings() {
    const [provider, setProvider] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(null); // 'save' | 'verify' | 'toggle' | 'remove'
    const [message, setMessage] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(false);

    const load = useCallback(async () => {
        try {
            setProvider(await getBankQrProvider());
            setLoadError(null);
        } catch (reason) {
            setLoadError(`No se pudo cargar la conexión con el banco (${reason.message}). ¿Se aplicó la migración del QR?`);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    async function run(kind, task) {
        setBusy(kind);
        setMessage(null);
        try {
            await task();
        } catch (reason) {
            setMessage(reason.message || 'No se pudo completar la operación.');
        } finally {
            setBusy(null);
        }
    }

    function startEditing() {
        setForm(
            provider?.configured
                ? {
                    ...emptyForm,
                    environment: provider.environment,
                    username: provider.username,
                    currency: provider.currency,
                    branchCode: provider.branch_code ?? '',
                }
                : emptyForm,
        );
        setMessage(null);
        setEditing(true);
    }

    const save = (event) => {
        event.preventDefault();
        run('save', async () => {
            await configureBankQr(form);
            setEditing(false);
            setForm(emptyForm);
            await load();
            toast.success('Conexión con el banco guardada y verificada.');
        });
    };

    const configured = provider?.configured ? provider : null;

    return (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '2rem auto' }}>
            {confirmRemove && (
                <ConfirmDialog
                    message="¿Quitar la conexión con el banco? Se borran las credenciales guardadas. Los cobros QR ya registrados se conservan."
                    onConfirm={() => {
                        setConfirmRemove(false);
                        run('remove', async () => {
                            await removeBankQr();
                            await load();
                            toast.success('Conexión con el banco quitada.');
                        });
                    }}
                    onCancel={() => setConfirmRemove(false)}
                />
            )}

            <h2 style={styles.title}>📱 Cobro QR dinámico (Banco Económico)</h2>
            <p style={styles.muted}>
                Las ventas «QR» se cobran con un QR del banco que lleva el monto exacto. El pago se confirma solo y
                la venta se registra recién cuando el banco lo confirma. Si está desactivado, se usa el QR fijo de siempre.
            </p>

            {loadError && <p style={styles.error}>{loadError}</p>}
            {!provider && !loadError && <p style={styles.muted}>Cargando…</p>}

            {provider && !editing && !configured && (
                <>
                    <p style={styles.muted}>
                        Pide al banco el acceso a la API Market (usuario, contraseña y llave AES) para la cuenta donde quieres
                        recibir los cobros. Empieza con el ambiente de certificación para probar.
                    </p>
                    <button type="button" className="primary" onClick={startEditing}>Conectar cuenta del banco</button>
                </>
            )}

            {configured && !editing && (
                <>
                    <dl style={styles.summary}>
                        <dt>Estado</dt>
                        <dd style={{ color: configured.enabled ? '#4ade80' : '#fbbf24', fontWeight: 'bold' }}>
                            {configured.enabled ? 'Activo' : 'Desactivado'}
                        </dd>
                        <dt>Ambiente</dt>
                        <dd>{environmentLabel[configured.environment]}</dd>
                        <dt>Cuenta</dt>
                        <dd>•••• {configured.account_last4} · {configured.currency}</dd>
                        <dt>Usuario</dt>
                        <dd>{configured.username}</dd>
                        {configured.branch_code && (
                            <>
                                <dt>Sucursal</dt>
                                <dd>{configured.branch_code}</dd>
                            </>
                        )}
                        <dt>Última verificación</dt>
                        <dd>{configured.verified_at ? dateTime.format(new Date(configured.verified_at)) : '—'}</dd>
                    </dl>
                    <div style={styles.buttons}>
                        <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => run('verify', async () => {
                                await verifyBankQr();
                                await load();
                                toast.success('El banco aceptó las credenciales.');
                            })}
                        >
                            {busy === 'verify' ? 'Probando…' : 'Probar conexión'}
                        </button>
                        <button type="button" disabled={busy !== null} onClick={startEditing}>Cambiar credenciales</button>
                        <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => run('toggle', async () => {
                                await setBankQrEnabled(!configured.enabled);
                                await load();
                                toast.success(configured.enabled ? 'Cobro QR del banco desactivado.' : 'Cobro QR del banco activado.');
                            })}
                        >
                            {configured.enabled ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" className="danger" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                            Quitar
                        </button>
                    </div>
                </>
            )}

            {editing && (
                <form onSubmit={save}>
                    <p style={styles.muted}>
                        Se guardan cifradas y solo las usa el servidor; nadie podrá verlas desde la pantalla. Antes de guardar
                        se prueban con el banco.
                    </p>
                    <div style={styles.grid}>
                        <label style={styles.label}>
                            Ambiente
                            <select style={styles.input} value={form.environment} onChange={(e) => field('environment', e.target.value)}>
                                <option value="certification">{environmentLabel.certification}</option>
                                <option value="production">{environmentLabel.production}</option>
                            </select>
                        </label>
                        <label style={styles.label}>
                            Usuario asignado por el banco
                            <input value={form.username} autoComplete="off" required onChange={(e) => field('username', e.target.value)} />
                        </label>
                        <label style={styles.label}>
                            Contraseña
                            <input type="password" value={form.password} autoComplete="new-password" required onChange={(e) => field('password', e.target.value)} />
                        </label>
                        <label style={styles.label}>
                            Llave AES
                            <input type="password" value={form.aesKey} autoComplete="off" required onChange={(e) => field('aesKey', e.target.value)} />
                        </label>
                        <label style={styles.label}>
                            Número de cuenta que recibe los cobros
                            <input inputMode="numeric" value={form.account} autoComplete="off" required onChange={(e) => field('account', e.target.value)} />
                        </label>
                        <label style={styles.label}>
                            Moneda de la cuenta
                            <select style={styles.input} value={form.currency} onChange={(e) => field('currency', e.target.value)}>
                                <option value="BOB">Bolivianos (BOB)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </label>
                        <label style={styles.label}>
                            Código de sucursal (opcional, hasta 5 caracteres)
                            <input value={form.branchCode} maxLength={5} autoComplete="off" onChange={(e) => field('branchCode', e.target.value)} />
                        </label>
                    </div>
                    {message && <p style={styles.error} role="alert">{message}</p>}
                    <div style={styles.buttons}>
                        <button type="button" disabled={busy !== null} onClick={() => setEditing(false)}>Cancelar</button>
                        <button type="submit" className="primary" disabled={busy !== null}>
                            {busy === 'save' ? 'Verificando con el banco…' : 'Guardar y verificar'}
                        </button>
                    </div>
                </form>
            )}

            {!editing && message && <p style={styles.error} role="alert">{message}</p>}

            {configured?.enabled && !editing && <TestCharge />}
        </div>
    );
}

/** Un cobro real pequeño para probar todo el flujo antes de usarlo en las ventas. No registra ninguna venta. */
function TestCharge() {
    const [amount, setAmount] = useState('1');
    const charge = useBankQrPayment();
    const value = parseFloat(String(amount).replace(',', '.'));
    const payment = charge.payment;

    return (
        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.5rem', paddingTop: '1rem' }}>
            <strong>Probar un cobro</strong>
            <p style={styles.muted}>Genera un QR y págalo desde la app de cualquier banco (desde otra cuenta, no la que recibe).</p>
            {!charge.qr ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <label style={{ ...styles.label, flex: 1 }}>
                        Monto (Bs.)
                        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </label>
                    <button
                        type="button"
                        className="primary"
                        disabled={!(value > 0) || charge.busy !== null}
                        onClick={() => charge.generate({ amount: value })}
                    >
                        {charge.busy === 'generate' ? 'Generando…' : 'Generar QR de prueba'}
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <img
                        src={`data:image/png;base64,${charge.qr.qrImage}`}
                        alt={`QR de cobro por Bs. ${charge.qr.amount}`}
                        style={{ width: '180px', background: '#fff', padding: '6px', borderRadius: '8px' }}
                    />
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <strong style={{ fontSize: '1.3rem' }}>Bs. {Number(charge.qr.amount).toFixed(2)}</strong>
                        {charge.status === 'paid' ? (
                            <p style={{ color: '#4ade80' }} role="status">
                                Pagado{payment?.payer_name ? ` por ${payment.payer_name}` : ''}
                                {payment?.bank_transaction_id ? ` · transacción ${payment.bank_transaction_id}` : ''}
                            </p>
                        ) : charge.status === 'cancelled' ? (
                            <p style={styles.muted} role="status">QR anulado.</p>
                        ) : (
                            <p style={styles.muted} role="status">
                                {charge.waiting ? '⏳ Esperando el pago…' : 'Ya no se consulta solo; usa «Consultar».'}
                            </p>
                        )}
                        <small style={styles.muted}>QR {charge.qr.qrId} · vence el {charge.qr.dueDate}</small>
                        <div style={{ ...styles.buttons, justifyContent: 'flex-start' }}>
                            {charge.status === 'pending' && (
                                <>
                                    <button type="button" disabled={charge.busy !== null} onClick={() => charge.check()}>
                                        {charge.busy === 'check' ? 'Consultando…' : 'Consultar'}
                                    </button>
                                    <button type="button" disabled={charge.busy !== null} onClick={() => charge.cancel()}>
                                        {charge.busy === 'cancel' ? 'Anulando…' : 'Anular'}
                                    </button>
                                </>
                            )}
                            {charge.status !== 'pending' && (
                                <button type="button" onClick={charge.reset}>Otra prueba</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {charge.error && <p style={styles.error} role="alert">{charge.error}</p>}
        </div>
    );
}

const styles = {
    title: {
        color: 'var(--accent-color)', marginTop: 0, fontSize: '1.5rem',
        borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem',
    },
    muted: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' },
    error: { color: '#fca5a5', fontSize: '0.9rem' },
    summary: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem', margin: '1rem 0' },
    buttons: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' },
    label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' },
    input: {
        width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #334155',
        backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)',
    },
};
