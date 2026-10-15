import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export default function AdjustStockModal({ part, mode, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1);
    const [error, setError] = useState('');
    const [pendingQuantity, setPendingQuantity] = useState(null);
    const isAdding = mode === 'add';

    const handleSubmit = (e) => {
        e.preventDefault();
        const parsedQuantity = Number(quantity);
        if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
            setError('Ingresa una cantidad entera mayor o igual a 1.');
            return;
        }
        if (!isAdding && parsedQuantity > Number(part.stock || 0)) {
            setError(`No puedes retirar ${parsedQuantity}; el stock actual es ${part.stock || 0}.`);
            return;
        }
        setError('');
        setPendingQuantity(isAdding ? parsedQuantity : -parsedQuantity);
    };

    return (
        <>
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
                    <h3 style={{ marginTop: 0 }}>
                        {isAdding ? 'Añadir Stock' : 'Reducir Stock'}: {part.codigo_producto || part.name}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        {isAdding
                            ? 'Ingresa la cantidad de piezas que llegaron.'
                            : 'Ingresa la cantidad de piezas a retirar (error de carga).'}
                    </p>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Cantidad</label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => { setQuantity(e.target.value); setError(''); }}
                                required
                                autoFocus
                            />
                            {error && <small style={{ display: 'block', marginTop: '0.4rem', color: '#fca5a5' }}>{error}</small>}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={onClose} style={{
                                backgroundColor: 'transparent',
                                color: '#ccc',
                                border: '1px solid #555'
                            }}>
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="primary"
                                style={{ backgroundColor: isAdding ? '#10b981' : '#f43f5e' }}
                            >
                                {isAdding ? 'Continuar' : 'Continuar retiro'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {pendingQuantity !== null && (
                <ConfirmDialog
                    message={isAdding
                        ? `¿Confirmar el ingreso de ${pendingQuantity} unidad(es) de ${part.codigo_producto || part.name}?`
                        : `¿Confirmar el retiro de ${Math.abs(pendingQuantity)} unidad(es) de ${part.codigo_producto || part.name}? El stock se reducirá inmediatamente.`}
                    onConfirm={() => {
                        const value = pendingQuantity;
                        setPendingQuantity(null);
                        onConfirm(value);
                    }}
                    onCancel={() => setPendingQuantity(null)}
                />
            )}
        </>
    );
}
