import React, { useState } from 'react';
import * as api from '../lib/api';
import { toast } from '../lib/toast';

const EMPTY = {
    familia: '', codigo: '', codigo_producto: '', marca: '', mundial: '',
    internal_measure: '', external_measure: '', height: '',
    flange_measure: '', tope: '', stock: '',
    aplicacion: '', cost_price: '', pv_geli: ''
};

export default function PartForm({ onPartAdded }) {
    const [formData, setFormData] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const validate = () => {
        const e = {};

        if (!formData.codigo_producto.trim()) e.codigo_producto = 'Requerido';

        // Medidas obligatorias: número válido y mayor que 0
        [['internal_measure', 'Interna'], ['external_measure', 'Externa'], ['height', 'Altura']].forEach(([k]) => {
            const v = formData[k];
            if (v === '' || v === null) e[k] = 'Requerido';
            else if (isNaN(parseFloat(v)) || parseFloat(v) <= 0) e[k] = 'Debe ser mayor que 0';
        });

        // Medidas opcionales: si se ponen, no pueden ser negativas
        [['flange_measure'], ['tope']].forEach(([k]) => {
            if (formData[k] !== '' && (isNaN(parseFloat(formData[k])) || parseFloat(formData[k]) < 0)) {
                e[k] = 'No puede ser negativo';
            }
        });

        // Stock: entero >= 0
        if (formData.stock === '') e.stock = 'Requerido';
        else if (!Number.isInteger(Number(formData.stock)) || Number(formData.stock) < 0) e.stock = 'Entero ≥ 0';

        // Costo opcional: si se pone, >= 0
        if (formData.cost_price !== '' && (isNaN(parseFloat(formData.cost_price)) || parseFloat(formData.cost_price) < 0)) {
            e.cost_price = 'No puede ser negativo';
        }

        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            toast.error('Revisa los campos marcados en rojo antes de guardar');
            return;
        }
        setErrors({});
        setLoading(true);
        try {
            await api.createPart(formData);
            setFormData(EMPTY);
            onPartAdded();
        } catch (error) {
            console.error('Error adding part:', error);
            toast.error('No se pudo registrar el repuesto: ' + (error.message || 'error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Limpia el error del campo en cuanto el usuario lo corrige
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    // Borde rojo cuando el campo tiene error
    const inErr = (name) => errors[name] ? { borderColor: 'var(--danger-color)', boxShadow: '0 0 0 1px var(--danger-color)' } : undefined;
    const Err = ({ name }) => errors[name]
        ? <span style={{ color: 'var(--danger-color)', fontSize: '0.72rem', marginTop: '3px', display: 'block' }}>{errors[name]}</span>
        : null;
    const labelStyle = { display: 'block', marginBottom: '.5rem', fontSize: '.9rem' };

    return (
        <form onSubmit={handleSubmit} className="glass-panel" style={{ marginBottom: '2rem' }} noValidate>
            <h2 style={{ marginTop: 0 }}>Registrar Nuevo Repuesto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
                <div>
                    <label style={labelStyle}>Familia</label>
                    <input name="familia" value={formData.familia} onChange={handleChange} placeholder="Ej. RETEN" />
                </div>

                <div>
                    <label style={labelStyle}>Codigo Producto *</label>
                    <input name="codigo_producto" value={formData.codigo_producto} onChange={handleChange} placeholder="Ej. TPF608" style={inErr('codigo_producto')} />
                    <Err name="codigo_producto" />
                </div>

                <div>
                    <label style={labelStyle}>Codigo</label>
                    <input name="codigo" value={formData.codigo} onChange={handleChange} placeholder="Ej. G-S" />
                </div>

                <div>
                    <label style={labelStyle}>Marca</label>
                    <input name="marca" value={formData.marca} onChange={handleChange} placeholder="Suzuki o toyota" />
                </div>

                <div>
                    <label style={labelStyle}>Mundial</label>
                    <input name="mundial" value={formData.mundial} onChange={handleChange} placeholder="Mundial" />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Descripción</label>
                    <input name="aplicacion" value={formData.aplicacion} onChange={handleChange} placeholder="Detalles adicionales..." />
                </div>

                <div>
                    <label style={labelStyle}>Interna (mm) *</label>
                    <input type="number" step="0.01" min="0" name="internal_measure" value={formData.internal_measure} onChange={handleChange} placeholder="0.0" style={inErr('internal_measure')} />
                    <Err name="internal_measure" />
                </div>
                <div>
                    <label style={labelStyle}>Externa (mm) *</label>
                    <input type="number" step="0.01" min="0" name="external_measure" value={formData.external_measure} onChange={handleChange} placeholder="0.0" style={inErr('external_measure')} />
                    <Err name="external_measure" />
                </div>
                <div>
                    <label style={labelStyle}>Altura (mm) *</label>
                    <input type="number" step="0.01" min="0" name="height" value={formData.height} onChange={handleChange} placeholder="0.0" style={inErr('height')} />
                    <Err name="height" />
                </div>
                <div>
                    <label style={labelStyle}>Pestaña (mm)</label>
                    <input type="number" step="0.01" min="0" name="flange_measure" value={formData.flange_measure} onChange={handleChange} placeholder="0.0" style={inErr('flange_measure')} />
                    <Err name="flange_measure" />
                </div>

                <div>
                    <label style={labelStyle}>Tope (mm)</label>
                    <input type="number" step="0.01" min="0" name="tope" value={formData.tope} onChange={handleChange} placeholder="0.0" style={inErr('tope')} />
                    <Err name="tope" />
                </div>

                <div>
                    <label style={labelStyle}>Stock Inicial *</label>
                    <input type="number" min="0" step="1" name="stock" value={formData.stock} onChange={handleChange} placeholder="0" style={inErr('stock')} />
                    <Err name="stock" />
                </div>

                <div>
                    <label style={labelStyle}>Costo (Bs.)</label>
                    <input type="number" step="0.01" min="0" name="cost_price" value={formData.cost_price} onChange={handleChange} placeholder="0.00" style={inErr('cost_price')} />
                    <Err name="cost_price" />
                </div>

                <div>
                    <label style={labelStyle}>PV GELIPE</label>
                    <input name="pv_geli" value={formData.pv_geli} onChange={handleChange} placeholder="Ej. GELIPE-123" />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', minHeight: '62px' }}>
                    <button type="submit" className="primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Guardando...' : 'Agregar'}
                    </button>
                </div>
            </div>
        </form>
    );
}
