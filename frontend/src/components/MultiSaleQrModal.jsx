import React, { useEffect, useState } from 'react';
import { ArrowLeft, QrCode, Trash2, X } from 'lucide-react';
import * as api from '../lib/api';
import { isBankQrEnabled } from '../lib/bankQr';
import { toast } from '../lib/toast';
import BankQrCheckout from './BankQrCheckout';

const money = (value) => `Bs. ${Number(value || 0).toFixed(2)}`;
const itemName = (part) => part.codigo_producto || part.name || part.codigo || `Producto #${part.id}`;

export default function MultiSaleQrModal({ items, onItemsChange, onClose, onRegistered }) {
    const [bankQr, setBankQr] = useState(null);
    const [invoiceType, setInvoiceType] = useState('SIN_FACTURA');
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [qrCharge, setQrCharge] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const cartItems = Array.isArray(items) ? items : [];

    useEffect(() => {
        let active = true;
        isBankQrEnabled()
            .then((enabled) => active && setBankQr(enabled))
            .catch(() => active && setBankQr(false));
        return () => { active = false; };
    }, []);

    const total = cartItems.reduce((sum, item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + unitPrice * quantity;
    }, 0);

    const updateItem = (id, field, value) => {
        onItemsChange((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id) => {
        onItemsChange((current) => current.filter((item) => item.id !== id));
    };

    const validateItems = () => {
        if (cartItems.length === 0) {
            toast.error('Agrega productos desde la lista de Productos.');
            return false;
        }
        const invalid = cartItems.find((item) => {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);
            return !Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(item.stock || 0)
                || !Number.isFinite(unitPrice) || unitPrice <= 0;
        });
        if (invalid) {
            toast.error(`Revisa cantidad y precio de "${itemName(invalid)}".`);
            return false;
        }
        const underCost = cartItems.find((item) => Number(item.cost_price || 0) > Number(item.unit_price));
        if (underCost) {
            toast.error(`"${itemName(underCost)}" no puede venderse bajo su costo base de ${money(underCost.cost_price)}.`);
            return false;
        }
        return true;
    };

    const startPayment = async () => {
        if (!validateItems()) return;
        if (!paymentMethod) {
            toast.info('Elige cómo pagará el cliente.');
            return;
        }
        if (paymentMethod === 'qr' && bankQr !== true) {
            toast.error('Activa el QR dinámico del banco en Mantenimiento para cobrar esta venta.');
            return;
        }

        const saleItems = cartItems.map((item) => ({
            part_id: Number(item.id),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
        }));

        if (paymentMethod === 'qr') {
            setQrCharge({
                kind: 'sale_cart',
                payload: { invoice_type: `${invoiceType}_QR`, items: saleItems },
            });
            return;
        }

        setSubmitting(true);
        try {
            const result = await api.createMultiSale({ items: saleItems, invoice_type: invoiceType });
            onItemsChange([]);
            onRegistered?.({ method: 'cash', ...result.data });
            onClose();
        } catch (error) {
            toast.error(`No se pudo registrar la venta: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (qrCharge) {
        return (
            <BankQrCheckout
                charge={qrCharge}
                onRegistered={(payment) => {
                    onItemsChange([]);
                    onRegistered?.(payment);
                }}
                onCancelled={() => setQrCharge(null)}
                onClose={onClose}
            />
        );
    }

    return (
        <div className="multi-sale-qr-overlay" role="presentation">
            <section className="multi-sale-qr-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="multi-sale-title">
                <header className="multi-sale-qr-header">
                    <div>
                        <span className="multi-sale-qr-eyebrow">CARRITO DE VENTA · {cartItems.length} {cartItems.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}</span>
                        <h2 id="multi-sale-title">Revisa y cobra</h2>
                    </div>
                    <button type="button" className="multi-sale-qr-close" onClick={onClose} aria-label="Cerrar carrito y volver a Productos">
                        <X size={19} />
                    </button>
                </header>

                <div className="multi-sale-qr-body">
                    <div className="multi-sale-qr-review-heading">
                        <h3>Productos seleccionados</h3>
                        <button type="button" onClick={onClose}>
                            <ArrowLeft size={15} /> Seguir agregando
                        </button>
                    </div>

                    {cartItems.length === 0 ? (
                        <div className="multi-sale-qr-empty">El carrito está vacío. Vuelve a Productos y pulsa «Venta múltiple» en cada producto que quieras agregar.</div>
                    ) : (
                        <div className="multi-sale-qr-items">
                            {cartItems.map((item) => {
                                const belowCost = Number(item.unit_price || 0) < Number(item.cost_price || 0);
                                return (
                                    <article className="multi-sale-qr-item" key={item.id}>
                                        <div className="multi-sale-qr-item-title">
                                            <strong>{itemName(item)}</strong>
                                            <small>Stock disponible: {item.stock ?? 0}</small>
                                        </div>
                                        <label>
                                            <span>Cantidad</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max={item.stock}
                                                step="1"
                                                value={item.quantity}
                                                onChange={(event) => updateItem(item.id, 'quantity', event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>Precio unitario (Bs.)</span>
                                            <input
                                                type="number"
                                                min={Number(item.cost_price || 0)}
                                                step="0.01"
                                                value={item.unit_price}
                                                className={belowCost ? 'is-invalid' : ''}
                                                onChange={(event) => updateItem(item.id, 'unit_price', event.target.value)}
                                            />
                                        </label>
                                        <strong className="multi-sale-qr-subtotal">{money(Number(item.unit_price || 0) * Number(item.quantity || 0))}</strong>
                                        <button type="button" onClick={() => removeItem(item.id)} aria-label={`Quitar ${itemName(item)}`}>
                                            <Trash2 size={17} />
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {bankQr === false && (
                        <div className="multi-sale-qr-notice" role="status">
                            El QR dinámico no está activo. Puedes cobrar en efectivo o activarlo en Mantenimiento.
                        </div>
                    )}
                    {bankQr === null && <p className="multi-sale-qr-muted" role="status">Verificando el QR del banco…</p>}

                    <label className="multi-sale-qr-label" htmlFor="multi-sale-invoice-type">Comprobante</label>
                    <select
                        id="multi-sale-invoice-type"
                        value={invoiceType}
                        onChange={(event) => setInvoiceType(event.target.value)}
                    >
                        <option value="SIN_FACTURA">Venta sin factura</option>
                        <option value="FACTURA">Venta con factura</option>
                    </select>

                    <div className="multi-sale-qr-methods" role="group" aria-label="Método de pago">
                        <span>Cuando termines, elige cómo pagará el cliente:</span>
                        <div>
                            <button
                                type="button"
                                className={paymentMethod === 'cash' ? 'multi-sale-pay-option active' : 'multi-sale-pay-option'}
                                aria-pressed={paymentMethod === 'cash'}
                                onClick={() => setPaymentMethod('cash')}
                            >
                                Efectivo
                            </button>
                            <button
                                type="button"
                                className={paymentMethod === 'qr' ? 'multi-sale-pay-option active' : 'multi-sale-pay-option'}
                                aria-pressed={paymentMethod === 'qr'}
                                disabled={bankQr !== true}
                                title={bankQr === false ? 'Activa el QR dinámico en Mantenimiento' : undefined}
                                onClick={() => setPaymentMethod('qr')}
                            >
                                <QrCode size={15} /> QR dinámico
                            </button>
                        </div>
                    </div>
                </div>

                <footer className="multi-sale-qr-footer multi-sale-qr-footer--payment">
                    <div className="multi-sale-qr-total">
                        <span>Total de la venta</span>
                        <strong>{money(total)}</strong>
                    </div>
                    <button
                        type="button"
                        className="primary multi-sale-qr-submit"
                        onClick={startPayment}
                        disabled={cartItems.length === 0 || !paymentMethod || submitting || (paymentMethod === 'qr' && bankQr !== true)}
                    >
                        {paymentMethod === 'qr' ? <QrCode size={17} /> : null}
                        {submitting
                            ? 'Registrando…'
                            : paymentMethod === 'qr'
                                ? `Generar QR por ${money(total)}`
                                : paymentMethod === 'cash'
                                    ? `Registrar venta por ${money(total)}`
                                    : 'Elige efectivo o QR'}
                    </button>
                </footer>
            </section>
        </div>
    );
}
