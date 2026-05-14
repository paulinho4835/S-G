import React, { useState } from 'react';

export default function BulkUpload({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage('');
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Por favor selecciona un archivo Excel');
            return;
        }

        setUploading(true);
        setMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/parts/bulk-upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.message === 'success') {
                setMessage(`✅ ${data.imported} productos importados correctamente`);
                setFile(null);
                onUploadComplete();
            } else {
                setMessage(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            setMessage('❌ Error al cargar el archivo');
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>Carga Masiva desde Excel</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                El archivo debe tener las columnas: <strong>FAMILIA, CODIGO_PRODUCT, MARCA, MUNDIAL, PRECIO BAS, PV_GELIPE, STO, MI, ME, ALT, PES, TOP, APLICACION, CODIGO</strong>
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    style={{ flex: 1, minWidth: '200px' }}
                />
                <button
                    onClick={handleUpload}
                    disabled={uploading || !file}
                    className="primary"
                    style={{ minWidth: '120px' }}
                >
                    {uploading ? 'Cargando...' : 'Importar'}
                </button>
            </div>
            {message && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: message.startsWith('✅') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: message.startsWith('✅') ? '#34d399' : '#f87171'
                }}>
                    {message}
                </div>
            )}
        </div>
    );
}
