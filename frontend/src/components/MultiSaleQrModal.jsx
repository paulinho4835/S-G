import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import * as api from '../lib/api';
import { isBankQrEnabled } from '../lib/bankQr';
import { toast } from '../lib/toast';
import BankQrCheckout from './BankQrCheckout';

const money = (value) => `Bs. ${Number(value || 0).toFixed(2)}`;
const itemName = (part) => part.codigo_producto || part.name || part.codigo || `Producto #${part.id}`;

export default function MultiSaleQrModal({ parts, onClose, onRegistered }) {
    const [bankQr, setBankQr] = useState(null);
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [invoiceType, setInvoiceType] = useState('SIN_FACTURA');
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [step, setStep] = useState('products');
    const [qrCharge, setQrCharge] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        isBankQrEnabled().then((enabled) => active && setBankQr(enabled));
        return () => { active = false; };
    }, []);

    const total = items.reduce((sum, item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + unitPrice * quantity;
    }, 0);

    const matches = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return [];
        return parts
            .filter((part) => {
                const searchable = [part.codigo_producto, part.name, part.codigo, part.marca, part.aplicacion]
                    .filter(Boolean).join(' ').toLocaleLowerCase();
                return searchable.includes(query);
            })
            .slice(0, 6);
    }, [parts, search]);

    const addPart = (part) => {
        if (Number(part.stock || 0) <= 0) return;
        if (items.length >= 300) {
            toast.error('Una venta puede incluir como máximo 300 productos.');
            return;
        }
        if (items.some((item) => Number(item.id) === Number(part.id))) {
            toast.info(`"${itemName(part)}" ya está en la venta. Ajusta su cantidad.`);
            return;
        }
        setItems((current) => [...current, {
            ...part,
            quantity: 1,
            unit_price: part.pv_geli || part.cost_price || '',
        }]);
        setSearch('');
    };

    const updateItem = (id, field, value) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id) => setItems((current) => current.filter((item) => item.id !== id));

    const validateItems = () => {
        if (items.length === 0) {
            toast.error('Agrega al menos un producto a la venta.');
            return false;
        }
        const invalid = items.find((item) => {
            const quantity = Number(item.quantity);
            const unitPrice = Number(item.unit_price);
            return !Number.isSafeInteger(quantity) || quantity < 1 || quantity > Number(item.stock || 0)
                || !Number.isFinite(unitPrice) || unitPrice <= 0;
        });
        if (invalid) {
            toast.error(`Revisa cantidad y precio de "${itemName(invalid)}".`);
            return false;
        }
        const underCost = items.find((item) => Number(item.cost_price || 0) > Number(item.unit_price));
        if (underCost) {
            toast.error(`"${itemName(underCost)}" no puede venderse bajo su costo base de ${money(underCost.cost_price)}.`);
            return false;
        }
        return true;
    };

    const continueToPayment = () => {
        if (!validateItems()) return;
        setPaymentMethod(null);
        setStep('payment');
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

        const saleItems = items.map((item) => ({
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
                onRegistered={(payment) => onRegistered?.(payment)}
                onCancelled={() => setQrCharge(null)}
                onClose={onClose}
            />
        );
    }

    const isProductStep = step === 'products';

    return (
        <div className="multi-sale-qr-overlay" role="presentation">
            <section className="multi-sale-qr-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="multi-sale-title">
                <header className="multi-sale-qr-header">
                    <div>
                        <span className="multi-sale-qr-eyebrow">VENTA MÚLTIPLE · PASO {isProductStep ? '1' : '2'} DE 2</span>
                        <h2 id="multi-sale-title">{isProductStep ? 'Arma el carrito' : 'Elige cómo cobrar'}</h2>
                    </div>
                    <button type="button" className="multi-sale-qr-close" onClick={onClose} aria-label="Cerrar venta múltiple">
                        <X size={19} />
                    </button>
                </header>

                <div className="multi-sale-qr-progress" aria-label={`Paso ${isProductStep ? 1 : 2} de 2`}>
                    <span className={isProductStep ? 'active' : 'complete'}>1. Productos</span>
                    <span className={!isProductStep ? 'active' : ''}>2. Cobro</span>
                </div>

                {isProductStep ? (
                    <div className="multi-sale-qr-body">
                        <p className="multi-sale-qr-instruction">Busca y agrega todos los productos. Al terminar, revisarás el total y elegirás efectivo o QR.</p>
                        <label className="multi-sale-qr-label" htmlFor="multi-sale-product-search">Agregar producto</label>
                        <div className="multi-sale-qr-search">
                            <Search size={17} aria-hidden="true" />
                            <input
                                id="multi-sale-product-search"
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Busca por código, nombre o marca"
                                autoComplete="off"
                            />
                        </div>

                        {matches.length > 0 && (
                            <div className="multi-sale-qr-results" aria-label="Resultados de productos">
                                {matches.map((part) => {
                                    const added = items.some((item) => Number(item.id) === Number(part.id));
                                    const outOfStock = Number(part.stock || 0) <= 0;
                                    return (
                                        <button
                                            type="button"
                                            key={part.id}
                                            className="multi-sale-qr-result"
                                            disabled={added || outOfStock}
                                            onClick={() => addPart(part)}
                                        >
                                            <span>
                                                <strong>{itemName(part)}</strong>
                                                <small>Stock {part.stock ?? 0} · Precio sugerido {money(part.pv_geli || part.cost_price)}</small>
                                            </span>
                                            <Plus size={17} aria-hidden="true" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="multi-sale-qr-cart-heading">
                            <h3>Productos en el carrito</h3>
                            <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
                        </div>

                        {items.length === 0 ? (
                            <div className="multi-sale-qr-empty">Todavía no agregaste productos. Busca uno arriba para empezar.</div>
                        ) : (
                            <div className="multi-sale-qr-items">
                                {items.map((item) => {
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
                    </div>
                ) : (
                    <div className="multi-sale-qr-body">
                        {bankQr === false && (
                            <div className="multi-sale-qr-notice" role="status">
                                El QR dinámico no está activo. Puedes cobrar en efectivo o activarlo en Mantenimiento.
                            </div>
                        )}
                        {bankQr === null && <p className="multi-sale-qr-muted" role="status">Verificando el QR del banco…</p>}

                        <div className="multi-sale-qr-review-heading">
                            <h3>Revisa la venta</h3>
                            <button type="button" onClick={() => setStep('products')}>
                                <ArrowLeft size={15} /> Editar productos
                            </button>
                        </div>
                        <div className="multi-sale-qr-review-items">
                            {items.map((item) => (
                                <div className="multi-sale-qr-review-item" key={item.id}>
                                    <span>
                                        <strong>{itemName(item)}</strong>
                                        <small>{item.quantity} × {money(item.unit_price)}</small>
                                    </span>
                                    <strong>{money(Number(item.quantity) * Number(item.unit_price))}</strong>
                                </div>
                            ))}
                        </div>

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
                            <span>¿Cómo pagará el cliente?</span>
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
                )}

                <footer className={`multi-sale-qr-footer${isProductStep ? '' : ' multi-sale-qr-footer--payment'}`}>
                    <div className="multi-sale-qr-total">
                        <span>Total de la venta · {items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
                        <strong>{money(total)}</strong>
                    </div>
                    {isProductStep ? (
                        <button
                            type="button"
                            className="primary multi-sale-qr-submit"
                            onClick={continueToPayment}
                            disabled={items.length === 0}
                        >
                            Revisar y elegir pago
                        </button>
                    ) : (
                        <div className="multi-sale-qr-payment-actions">
                            <button type="button" className="multi-sale-qr-back" onClick={() => setStep('products')}>
                                <ArrowLeft size={16} /> Volver al carrito
                            </button>
                            <button
                                type="button"
                                className="primary multi-sale-qr-submit"
                                onClick={startPayment}
                                disabled={!paymentMethod || submitting || (paymentMethod === 'qr' && bankQr !== true)}
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
                        </div>
                    )}
                </footer>
            </section>
        </div>
    );
}
