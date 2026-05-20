import React, { useState } from 'react';
import { toast } from '../lib/toast';

export default function SalesModal({ part, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState('');
    const [invoiceType, setInvoiceType] = useState('SIN_FACTURA');

    const handleSubmit = (e) => {
        e.preventDefault();
        const unitPrice = parseFloat(price);
        const costPrice = parseFloat(part.cost_price || 0);
        
        if (unitPrice < costPrice) {
            toast.error(`¡Error! El precio de venta (Bs. ${unitPrice.toFixed(2)}) no puede ser menor al costo base (Bs. ${costPrice.toFixed(2)})`);
            return;
        }

        onConfirm({
            part_id: part.id,
            quantity: parseInt(quantity),
            unit_price: unitPrice,
            invoice_type: invoiceType
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div className="glass-panel" style={{ width: '400px', maxWidth: '90%' }}>
                <h3 style={{ marginTop: 0 }}>Vender {part.name}</h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Cantidad (Max: {part.stock})</label>
                        <input
                            type="number"
                            min="1"
                            max={part.stock}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label>Precio Unitario</label>
                            <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: '500' }}>
                                Costo Base: Bs. {parseFloat(part.cost_price || 0).toFixed(2)}
                            </span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder={`Mínimo: Bs. ${parseFloat(part.cost_price || 0).toFixed(2)}`}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Tipo de Venta</label>
                        <select
                            value={invoiceType}
                            onChange={(e) => setInvoiceType(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                borderRadius: '8px',
                                border: '1px solid #334155',
                                backgroundColor: 'var(--bg-color)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <option value="SIN_FACTURA">Venta sin factura</option>
                            <option value="SIN_FACTURA_QR">Venta sin factura QR</option>
                            <option value="FACTURA">Venta con factura</option>
                            <option value="FACTURA_QR">Venta con factura QR</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{
                            backgroundColor: 'transparent',
                            color: '#ccc',
                            border: '1px solid #555'
                        }}>
                            Cancelar
                        </button>
                        <button type="submit" className="primary">Confirmar Venta</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
