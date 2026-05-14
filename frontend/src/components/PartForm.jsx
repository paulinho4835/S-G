import React, { useState } from 'react';

export default function PartForm({ onPartAdded }) {
    const [formData, setFormData] = useState({
        familia: '',
        codigo: '',
        codigo_producto: '',
        marca: '',
        mundial: '',
        internal_measure: '',
        external_measure: '',
        height: '',
        flange_measure: '',
        tope: '',
        stock: '',
        aplicacion: '',
        cost_price: '',
        pv_geli: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('/api/parts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                setFormData({
                    familia: '', codigo: '', codigo_producto: '', marca: '', mundial: '',
                    internal_measure: '', external_measure: '', height: '',
                    flange_measure: '', tope: '', stock: '',
                    aplicacion: '', cost_price: '', pv_geli: ''
                });
                onPartAdded();
            }
        } catch (error) {
            console.error('Error adding part:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <form onSubmit={handleSubmit} className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginTop: 0 }}>Registrar Nuevo Repuesto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Familia</label>
                    <input name="familia" value={formData.familia} onChange={handleChange} placeholder="Ej. RETEN" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Codigo Producto</label>
                    <input required name="codigo_producto" value={formData.codigo_producto} onChange={handleChange} placeholder="Ej. TPF608" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Codigo</label>
                    <input name="codigo" value={formData.codigo} onChange={handleChange} placeholder="Ej. G-S" />
                </div>


                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Marca</label>
                    <input name="marca" value={formData.marca} onChange={handleChange} placeholder="Suzuki o toyota" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Mundial</label>
                    <input name="mundial" value={formData.mundial} onChange={handleChange} placeholder="Mundial" />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Descripción</label>
                    <input name="description" value={formData.description} onChange={handleChange} placeholder="Detalles adicionales..." />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Interna (mm)</label>
                    <input required type="number" step="0.01" name="internal_measure" value={formData.internal_measure} onChange={handleChange} placeholder="0.0" />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Externa (mm)</label>
                    <input required type="number" step="0.01" name="external_measure" value={formData.external_measure} onChange={handleChange} placeholder="0.0" />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Altura (mm)</label>
                    <input required type="number" step="0.01" name="height" value={formData.height} onChange={handleChange} placeholder="0.0" />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Pestaña (mm)</label>
                    <input type="number" step="0.01" name="flange_measure" value={formData.flange_measure} onChange={handleChange} placeholder="0.0" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Tope (mm)</label>
                    <input type="number" step="0.01" name="tope" value={formData.tope} onChange={handleChange} placeholder="0.0" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Stock Inicial</label>
                    <input required type="number" name="stock" value={formData.stock} onChange={handleChange} placeholder="0" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>Costo (Bs.)</label>
                    <input type="number" step="0.01" name="cost_price" value={formData.cost_price} onChange={handleChange} placeholder="0.00" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.9rem' }}>PV GELIPE</label>
                    <input name="pv_geli" value={formData.pv_geli} onChange={handleChange} placeholder="Ej. GELIPE-123" />
                </div>


                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Guardando...' : 'Agregar'}
                    </button>
                </div>
            </div>
        </form>
    );
}
