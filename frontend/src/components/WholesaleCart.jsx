import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, Loader2, FileText, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from '../lib/toast';
import * as api from '../lib/api';

export default function WholesaleCart({ cartItems, onUpdateItem, onRemoveItem, onClearCart, onOrderComplete, onQuoteComplete }) {
    const [cliente, setCliente] = useState('');
    const [invoiceType, setInvoiceType] = useState('MAYOR_SIN_FACTURA');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [quoting, setQuoting] = useState(false);

    const subtotal = cartItems.reduce((acc, item) => {
        const price = parseFloat(item.unit_price) || 0;
        const qty   = parseInt(item.quantity)    || 0;
        return acc + price * qty;
    }, 0);

    const validate = () => {
        if (!cliente.trim()) { toast.error('Ingresá el nombre del cliente.'); return false; }
        const invalidItem = cartItems.find(i => !parseFloat(i.unit_price) || !parseInt(i.quantity));
        if (invalidItem) { toast.error('Verificá que todos los ítems tengan cantidad y precio válidos.'); return false; }
        const underCostItem = cartItems.find(i => {
            const price = parseFloat(i.unit_price) || 0;
            const cost = parseFloat(i.cost_price) || 0;
            return cost > 0 && price < cost;
        });
        if (underCostItem) {
            toast.error(`"${underCostItem.codigo_producto || underCostItem.name}" no puede venderse bajo costo base Bs. ${parseFloat(underCostItem.cost_price).toFixed(2)}.`);
            return false;
        }
        return true;
    };

    const handleQuote = async () => {
        if (!validate()) return;
        setQuoting(true);
        try {
            const data = await api.createQuotation({
                cliente: cliente.trim(),
                invoice_type: invoiceType,
                notes,
                items: cartItems.map(i => ({ part_id: i.id, quantity: parseInt(i.quantity), unit_price: parseFloat(i.unit_price) }))
            });
            toast.success(`Cotización #${data.data.id} guardada`);
            onClearCart();
            setCliente('');
            setNotes('');
            if (onQuoteComplete) onQuoteComplete();
            try {
                await api.downloadQuotationPdf(data.data.id, 'cliente');
                await api.downloadQuotationPdf(data.data.id, 'interno');
            } catch (pdfErr) {
                toast.error('Cotización guardada, pero el PDF no está disponible (Edge Function no desplegada).');
                console.error('PDF error:', pdfErr);
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
            console.error('Quote error:', err);
        } finally {
            setQuoting(false);
        }
    };

    const handleConfirm = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const data = await api.createWholesaleOrder({
                cliente: cliente.trim(),
                invoice_type: invoiceType,
                notes,
                items: cartItems.map(i => ({
                    part_id:    i.id,
                    quantity:   parseInt(i.quantity),
                    unit_price: parseFloat(i.unit_price)
                }))
            });
            toast.success(`Venta Mayorista #${data.data.id} procesada — Total: Bs. ${subtotal.toFixed(2)}`);
            onClearCart();
            setCliente('');
            setNotes('');
            onOrderComplete();
        } catch (err) {
            toast.error(`Error: ${err.message}`);
            console.error('Wholesale error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (cartItems.length === 0) {
        return (
            <div style={styles.emptyState}>
                <ShoppingCart size={40} strokeWidth={1.2} color="var(--text-secondary)" style={{ marginBottom: '0.5rem' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                    El carrito está vacío.<br />
                    Haz clic en <strong style={{ color: '#f59e0b' }}>+ Mayor</strong> en cualquier producto.
                </p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <span style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShoppingCart size={16} /> Carrito Mayorista
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {cartItems.length} ítem(s)
                </span>
            </div>

            {/* Cliente */}
            <div style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                <label style={styles.label}>Cliente</label>
                <input
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    placeholder="Nombre o RIF del cliente..."
                    style={styles.input}
                />
                <label style={{ ...styles.label, marginTop: '0.5rem' }}>Comprobante</label>
                <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)} style={styles.input}>
                    <option value="MAYOR_SIN_FACTURA">Venta x Mayor Sin Factura</option>
                    <option value="MAYOR_SIN_FACTURA_QR">Venta x Mayor Sin Factura QR</option>
                    <option value="MAYOR_FACTURA">Venta x Mayor Factura</option>
                    <option value="MAYOR_FACTURA_QR">Venta x Mayor Factura QR</option>
                </select>
            </div>

            {/* Items list */}
            <div style={styles.itemsList}>
                {cartItems.map((item) => {
                    const priceVal = parseFloat(item.unit_price) || 0;
                    const costVal = parseFloat(item.cost_price) || 0;
                    const isBelowCost = costVal > 0 && priceVal < costVal;

                    return (
                        <div key={item.cartKey} style={styles.item}>
                            {/* Producto info */}
                            <div style={styles.itemInfo}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-color)', lineHeight: 1.2 }}>
                                    {item.codigo_producto || item.name || item.codigo}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    {item.internal_measure}×{item.external_measure}×{item.height}
                                    {item.marca ? ` · ${item.marca}` : ''}
                                </div>
                            </div>

                            {/* Cantidad + Precio */}
                            <div style={styles.itemControls}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={styles.miniLabel}>Cant.</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={item.stock}
                                        value={item.quantity}
                                        onChange={e => onUpdateItem(item.cartKey, 'quantity', e.target.value)}
                                        style={styles.smallInput}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={styles.miniLabel}>Precio Bs.</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={e => onUpdateItem(item.cartKey, 'unit_price', e.target.value)}
                                        style={{
                                            ...styles.smallInput,
                                            borderColor: isBelowCost ? '#ef4444' : '#334155',
                                            color: isBelowCost ? '#f87171' : 'var(--text-primary)',
                                            fontWeight: isBelowCost ? 'bold' : 'normal'
                                        }}
                                        title={isBelowCost ? `El precio está por debajo del costo base (Bs. ${costVal.toFixed(2)})` : ''}
                                    />
                                    {costVal > 0 && (
                                        <span style={{ fontSize: '0.65rem', color: isBelowCost ? '#f87171' : '#94a3b8', marginTop: '1px' }}>
                                            Costo: {costVal.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Subtotal + Remove */}
                            <div style={styles.itemFooter}>
                                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    Bs. {((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                                </span>
                                <button
                                    onClick={() => onRemoveItem(item.cartKey)}
                                    style={styles.removeBtn}
                                    title="Quitar del carrito"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Notes */}
            <div style={{ padding: '0.5rem 0.75rem' }}>
                <label style={styles.label}>Notas (opcional)</label>
                <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observaciones del pedido..."
                    style={styles.input}
                />
            </div>

            {/* Total + Actions */}
            <div style={styles.footer}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total:</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.3rem' }}>
                        Bs. {subtotal.toFixed(2)}
                    </span>
                </div>
                <button
                    onClick={handleQuote}
                    disabled={quoting || submitting}
                    style={{
                        width: '100%',
                        padding: '0.7rem',
                        backgroundColor: quoting ? '#475569' : '#3b82f6',
                        color: '#fff',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: (quoting || submitting) ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                >
                    {quoting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando PDF...</> : <><FileText size={14} /> Realizar Cotización</>}
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={submitting || quoting}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: (submitting || quoting) ? '#475569' : '#f59e0b',
                        color: '#0f172a',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: (submitting || quoting) ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        marginBottom: '0.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                >
                    {submitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</> : <><CheckCircle size={14} /> Confirmar Venta Mayorista</>}
                </button>
                <button
                    onClick={onClearCart}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        color: '#f87171',
                        border: '1px solid #f87171',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                    }}
                >
                    <Trash2 size={13} /> Vaciar Carrito
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderLeft: '1px solid #334155',
        backgroundColor: 'var(--card-bg)'
    },
    header: {
        padding: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #334155',
        backgroundColor: 'rgba(245, 158, 11, 0.08)'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        height: '100%',
        borderLeft: '1px solid #334155'
    },
    label: {
        display: 'block',
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        marginBottom: '3px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    miniLabel: {
        fontSize: '0.65rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase'
    },
    input: {
        width: '100%',
        padding: '0.4rem 0.6rem',
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '4px',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        boxSizing: 'border-box'
    },
    smallInput: {
        width: '72px',
        padding: '0.3rem',
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '4px',
        color: 'var(--text-primary)',
        fontSize: '0.8rem',
        textAlign: 'center'
    },
    itemsList: {
        overflowY: 'auto',
        flex: 1,
        padding: '0.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
    },
    item: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid #334155',
        borderRadius: '6px',
        padding: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
    },
    itemInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    itemControls: {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start'
    },
    itemFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    removeBtn: {
        background: 'transparent',
        color: '#f87171',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        padding: '2px 6px'
    },
    footer: {
        padding: '0.75rem',
        borderTop: '1px solid #334155',
        backgroundColor: 'rgba(245, 158, 11, 0.04)'
    }
};
