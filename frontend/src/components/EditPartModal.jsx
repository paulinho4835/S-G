import React, { useState } from 'react';

export default function EditPartModal({ part, onClose, onConfirm }) {
    const [formData, setFormData] = useState({
        familia: part.familia || '',
        codigo_producto: part.codigo_producto || '',
        codigo: part.codigo || '',
        marca: part.marca || '',
        mundial: part.mundial || '',
        internal_measure: part.internal_measure || 0,
        external_measure: part.external_measure || 0,
        height: part.height || 0,
        flange_measure: part.flange_measure || 0,
        tope: part.tope || 0,
        cost_price: part.cost_price || 0,
        pv_geli: part.pv_geli || '',
        aplicacion: part.aplicacion || part.description || ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`/api/parts/${part.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.message === 'success') {
                onConfirm();
                onClose();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error("Error updating part:", error);
            alert("Error al actualizar el producto");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '800px',
                padding: '2rem',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--accent-color)' }}>Modificar Producto</h2>
                    <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '1.5rem', padding: '0' }}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Familia</label>
                            <input name="familia" value={formData.familia} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Codigo Producto</label>
                            <input name="codigo_producto" value={formData.codigo_producto} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Codigo</label>
                            <input name="codigo" value={formData.codigo} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Marca</label>
                            <input name="marca" value={formData.marca} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mundial</label>
                            <input name="mundial" value={formData.mundial} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>MI (Interna)</label>
                            <input type="number" step="0.01" name="internal_measure" value={formData.internal_measure} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ME (Externa)</label>
                            <input type="number" step="0.01" name="external_measure" value={formData.external_measure} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ALT (Altura)</label>
                            <input type="number" step="0.01" name="height" value={formData.height} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>PES (Pestaña)</label>
                            <input type="number" step="0.01" name="flange_measure" value={formData.flange_measure} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>TOP (Tope)</label>
                            <input type="number" step="0.01" name="tope" value={formData.tope} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Precio Base (Bs.)</label>
                            <input type="number" step="0.01" name="cost_price" value={formData.cost_price} onChange={handleChange} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>PV GELIPE</label>
                            <input name="pv_geli" value={formData.pv_geli} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Aplicacion</label>
                        <textarea
                            name="aplicacion"
                            value={formData.aplicacion}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                background: 'var(--bg-color)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '0.6rem',
                                borderRadius: '0.5rem',
                                minHeight: '80px',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid #334155' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="primary"
                            disabled={loading}
                            style={{ flex: 1 }}
                        >
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
