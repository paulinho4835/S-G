const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3005;

// ─── Kardex Helper ────────────────────────────────────────────────────────────
// Inserts one row in stock_movements using the live stock value as balance.
function logMovement({ part_id, type, quantity, price = 0, concept = '' }) {
    db.get('SELECT stock FROM parts WHERE id = ?', [part_id], (err, row) => {
        if (err || !row) return;
        const balance = row.stock;
        db.run(
            'INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept) VALUES (?,?,?,?,?,?)',
            [part_id, type, quantity, price, balance, concept],
            (err) => { if (err) console.error('Kardex log error:', err.message); }
        );
    });
}
// ─────────────────────────────────────────────────────────────────────────────


// ─── Retroactive Kardex Migration ─────────────────────────────────────────────
// On startup: for every part that has stock > 0 but zero movements,
// insert a STOCK_INICIAL record so the Kardex is never blank.
function runKardexMigration() {
    const sql = `
        SELECT p.id, p.stock
        FROM parts p
        LEFT JOIN stock_movements sm ON sm.part_id = p.id
        WHERE p.stock > 0
        GROUP BY p.id
        HAVING COUNT(sm.id) = 0
    `;
    db.all(sql, [], (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        console.log(`[Kardex] Migrating ${rows.length} parts with no history...`);
        rows.forEach(row => {
            db.run(
                'INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept) VALUES (?,?,?,?,?,?)',
                [row.id, 'STOCK_INICIAL', row.stock, 0, row.stock, 'Stock inicial al activar el Kardex'],
                (err) => { if (err) console.error('Migration error:', err.message); }
            );
        });
    });
}
setTimeout(runKardexMigration, 1500); // Run after DB tables are fully initialized
// ─────────────────────────────────────────────────────────────────────────────


// Configure multer for file uploads
const uploadsDir = process.env.UPLOADS_PATH || path.resolve(__dirname, 'uploads');

// Ensure uploads directory exists
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(bodyParser.json());

// Absolute path resolution for packaged environment
const staticPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const indexPath = path.join(staticPath, 'index.html');

// Serve static files
app.use(express.static(staticPath));

// Explicit ROOT route for reliability
app.get('/', (req, res) => {
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Root load failed:', err);
            res.status(500).send(`<h3>Error de Carga</h3><p>No se pudo encontrar el archivo de la interfaz.</p><p>Ruta intentada: <code>${indexPath}</code></p>`);
        }
    });
});

// Diag endpoint
app.get('/api/diag', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM parts', [], (err, row) => {
        let stats = { size: 0 };
        const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'parts.db');
        if (fs.existsSync(dbPath)) {
            stats = fs.statSync(dbPath);
        }

        res.json({
            status: 'online',
            database: {
                path: dbPath,
                records: err ? 0 : (row ? row.count : 0),
                size_bytes: stats.size,
                error: err ? err.message : null
            },
            env: {
                NODE_ENV: process.env.NODE_ENV || 'production',
                PORT: PORT
            }
        });
    });
});

// Admin endpoint to force database restoration
app.post('/api/admin/restore-db', (req, res) => {
    const userDataDbPath = process.env.DATABASE_PATH;
    const bundledDbPath = path.resolve(__dirname, 'parts.db');

    if (!userDataDbPath || !fs.existsSync(bundledDbPath)) {
        return res.status(400).json({ error: 'Paths not found or not in production' });
    }

    try {
        // We can't easily copy while the DB is open, but we can try
        // A better way is to tell the user to restart, but let's try a simple copy
        fs.copyFileSync(bundledDbPath, userDataDbPath);
        res.json({ message: 'Success. Please restart the application to apply changes.' });
    } catch (err) {
        console.error('Restore failed:', err);
        res.status(500).json({ error: 'Failed to copy file: ' + err.message });
    }
});

// Routes will go here

// GET all parts
app.get('/api/parts', (req, res) => {
    const { search, internal, external, height } = req.query;
    let sql = 'SELECT * FROM parts WHERE 1=1';
    const params = [];

    if (search) {
        sql += ' AND (name LIKE ? OR codigo LIKE ? OR codigo_producto LIKE ? OR internal_measure LIKE ? OR external_measure LIKE ? OR flange_measure LIKE ? OR aplicacion LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }


    // Fuzzy search: +/- 0.2mm tolerance to match close measures automatically
    const TOLERANCE = 0.5;
    let orderParams = [];

    if (internal) {
        sql += ' AND internal_measure BETWEEN ? AND ?';
        params.push(parseFloat(internal) - TOLERANCE, parseFloat(internal) + TOLERANCE);
        orderParams.push(parseFloat(internal));
    }
    if (external) {
        sql += ' AND external_measure BETWEEN ? AND ?';
        params.push(parseFloat(external) - TOLERANCE, parseFloat(external) + TOLERANCE);
    }
    if (height) {
        sql += ' AND height BETWEEN ? AND ?';
        params.push(parseFloat(height) - TOLERANCE, parseFloat(height) + TOLERANCE);
    }

    // Order by: 
    // Always use strict numerical order: MI > ME > ALT
    sql += ' ORDER BY CAST(internal_measure AS REAL) ASC, CAST(external_measure AS REAL) ASC, CAST(height AS REAL) ASC';

    db.all(sql, params, (err, rows) => {

        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// GET Export all parts to Excel
app.get('/api/parts/export', (req, res) => {
    const sql = 'SELECT * FROM parts ORDER BY id DESC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        // Create workbook and worksheet
        const wb = xlsx.utils.book_new();

        // Format data for Excel - matching user's format exactly
        const excelData = rows.map(part => ({
            'FAMILIA': part.familia || '',
            'CODIGO_PRODUCT': part.codigo_producto || part.name || '',
            'MARCA': part.marca || '',
            'MUNDIAL': part.mundial || '',
            'PRECIO BAS': part.cost_price || 0,
            'PV_GELI': part.pv_geli || '',
            'STO': part.stock || 0,
            'MI': part.internal_measure,
            'ME': part.external_measure,
            'ALT': part.height,
            'PES': part.flange_measure || 0,
            'TOP': part.tope || 0,
            'APLICACION': part.aplicacion || '',
            'CODIGO': part.codigo || ''
        }));

        const ws = xlsx.utils.json_to_sheet(excelData);
        xlsx.utils.book_append_sheet(wb, ws, 'Productos');

        // Generate buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for download
        res.setHeader('Content-Disposition', 'attachment; filename=productos.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// GET single part
app.get('/api/parts/:id', (req, res) => {
    const sql = 'SELECT * FROM parts WHERE id = ?';
    const params = [req.params.id];
    db.get(sql, params, (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": row
        });
    });
});

// POST new part
app.post('/api/parts', (req, res) => {
    console.log('Received POST /api/parts:', req.body);
    const { familia, codigo, codigo_producto, marca, mundial, internal_measure, external_measure, height, aplicacion, description, stock, flange_measure, cost_price, tope, pv_geli } = req.body;
    // Accept either `aplicacion` or `description` (legacy field name) from the client
    const finalAplicacion = aplicacion || description || '';
    const sql = 'INSERT INTO parts (familia, codigo, codigo_producto, name, marca, mundial, internal_measure, external_measure, height, description, aplicacion, stock, flange_measure, cost_price, tope, pv_geli) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    const params = [familia || '', codigo || '', codigo_producto || '', codigo_producto || '', marca || '', mundial || '', internal_measure, external_measure, height, finalAplicacion, finalAplicacion, stock || 0, flange_measure || 0, cost_price || 0, tope || 0, pv_geli || ''];
    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        const newId = this.lastID;
        const initialStock = parseInt(stock) || 0;
        // Log Kardex: manual product creation
        if (initialStock > 0) {
            logMovement({
                part_id: newId,
                type: 'REGISTRO_NUEVO',
                quantity: initialStock,
                price: parseFloat(cost_price) || 0,
                concept: `Registro manual de producto (${initialStock} unidades iniciales)`
            });
        }
        res.json({
            "message": "success",
            "data": {
                id: newId,
                familia,
                codigo,
                codigo_producto,
                marca,
                mundial,
                internal_measure,
                external_measure,
                height,
                aplicacion,
                stock,
                flange_measure,
                cost_price,
                tope,
                pv_geli
            }
        });
    });
});

// PUT update part
app.put('/api/parts/:id', (req, res) => {
    const { familia, codigo, codigo_producto, marca, mundial, internal_measure, external_measure, height, aplicacion, description, stock, flange_measure, cost_price, tope, pv_geli } = req.body;
    // Accept either `aplicacion` or `description` (legacy field name) from the client
    const finalAplicacion = aplicacion || description || undefined;
    const sql = `UPDATE parts set 
           familia = COALESCE(?,familia),
           codigo = COALESCE(?,codigo),
           codigo_producto = COALESCE(?,codigo_producto),
           name = COALESCE(?,name),
           marca = COALESCE(?,marca),
           mundial = COALESCE(?,mundial),
           internal_measure = COALESCE(?,internal_measure), 
           external_measure = COALESCE(?,external_measure), 
           height = COALESCE(?,height),
           description = COALESCE(?,description),
           aplicacion = COALESCE(?,aplicacion),
           stock = COALESCE(?,stock),
           flange_measure = COALESCE(?,flange_measure),
           cost_price = COALESCE(?,cost_price),
           tope = COALESCE(?,tope),
           pv_geli = COALESCE(?,pv_geli)
           WHERE id = ?`;
    const partId = req.params.id;
    const params = [familia, codigo, codigo_producto, codigo_producto, marca, mundial, internal_measure, external_measure, height, finalAplicacion, finalAplicacion, stock, flange_measure, cost_price, tope, pv_geli, partId];

    // Before updating, read current stock to detect changes
    db.get('SELECT stock FROM parts WHERE id = ?', [partId], (err, oldRow) => {
        if (err) { res.status(400).json({ error: err.message }); return; }

        db.run(sql, params, function (err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }

            // Log Kardex if stock was explicitly changed
            if (stock !== undefined && stock !== null && oldRow) {
                const newStock = parseInt(stock);
                const oldStock = parseInt(oldRow.stock) || 0;
                const diff = newStock - oldStock;
                if (diff !== 0) {
                    logMovement({
                        part_id: partId,
                        type: diff > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
                        quantity: diff,
                        price: 0,
                        concept: `Modificación directa de stock (${oldStock} → ${newStock})`
                    });
                }
            }

            res.json({
                message: "success",
                data: {
                    id: partId,
                    familia,
                    codigo,
                    codigo_producto,
                    marca,
                    mundial,
                    internal_measure,
                    external_measure,
                    height,
                    aplicacion,
                    stock,
                    flange_measure,
                    cost_price,
                    tope,
                    pv_geli
                }
            });
        });
    });
});

// DELETE part (cascade: removes kardex and sales first, then the part)
app.delete('/api/parts/:id', (req, res) => {
    const partId = req.params.id;

    // Delete stock_movements (Kardex) first to avoid FK constraint
    db.run('DELETE FROM stock_movements WHERE part_id = ?', [partId], (err) => {
        if (err) {
            res.status(500).json({ "error": "Error eliminando historial de Kardex: " + err.message });
            return;
        }

        // Delete associated sales
        db.run('DELETE FROM sales WHERE part_id = ?', [partId], (err) => {
            if (err) {
                res.status(500).json({ "error": "Error eliminando ventas asociadas: " + err.message });
                return;
            }

            // Now safe to delete the part
            db.run('DELETE FROM parts WHERE id = ?', [partId], function (err) {
                if (err) {
                    res.status(400).json({ "error": err.message });
                    return;
                }
                res.json({ "message": "deleted", changes: this.changes });
            });
        });
    });
});

// SALES ROUTES

// GET Sales History
app.get('/api/sales', (req, res) => {
    // Optional filter by date (YYYY-MM-DD or 'today')
    const { date, startDate, endDate } = req.query;
    let sql = `
        SELECT sales.*, parts.name as part_name, parts.codigo, parts.codigo_producto, parts.aplicacion
        FROM sales 
        JOIN parts ON sales.part_id = parts.id
        WHERE 1=1
    `;
    const params = [];

    if (date) {
        if (date === 'today') {
            sql += ` AND date(sales.sale_date, 'localtime') = date('now', 'localtime')`;
        } else {
            sql += ` AND date(sales.sale_date) = ?`;
            params.push(date);
        }
    } else if (startDate || endDate) {
        if (startDate && endDate) {
            sql += ` AND date(sales.sale_date) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        } else if (startDate) {
            sql += ` AND date(sales.sale_date) >= ?`;
            params.push(startDate);
        } else if (endDate) {
            sql += ` AND date(sales.sale_date) <= ?`;
            params.push(endDate);
        }
    } else {
        // DEFAULT: Show only today's sales if no date filters are present
        sql += ` AND date(sales.sale_date, 'localtime') = date('now', 'localtime')`;
    }

    sql += ' ORDER BY sales.sale_date ASC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// GET Sales Summary by Period (today | week | month)
app.get('/api/sales/summary', (req, res) => {
    const { period } = req.query; // 'today' | 'week' | 'month'

    let dateFilter;
    if (period === 'week') {
        dateFilter = `date(sales.sale_date, 'localtime') >= date('now', '-6 days', 'localtime')`;
    } else if (period === 'month') {
        dateFilter = `strftime('%Y-%m', sales.sale_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`;
    } else {
        // Default: today
        dateFilter = `date(sales.sale_date, 'localtime') = date('now', 'localtime')`;
    }

    const sql = `
        SELECT
            COALESCE(SUM(total_price), 0)  AS total_bs,
            COALESCE(SUM(quantity), 0)     AS units_sold,
            COUNT(*)                        AS transactions
        FROM sales
        WHERE ${dateFilter}
          AND (status IS NULL OR status != 'returned')
    `;

    db.get(sql, [], (err, row) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: 'success',
            data: {
                total_bs:     parseFloat(row.total_bs)    || 0,
                units_sold:   parseInt(row.units_sold)    || 0,
                transactions: parseInt(row.transactions)  || 0,
                period: period || 'today'
            }
        });
    });
});

// POST New Sale
app.post('/api/sales', (req, res) => {
    const { part_id, quantity, unit_price, invoice_type } = req.body;

    // First check stock
    db.get('SELECT stock, name FROM parts WHERE id = ?', [part_id], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ "error": "Part not found" });
            return;
        }
        if (row.stock < quantity) {
            res.status(400).json({ "error": `Not enough stock. Only ${row.stock} available.` });
            return;
        }

        // Calculate total
        const price = parseFloat(unit_price) || 0;
        const total = price * quantity;
        const invoice = invoice_type || 'SIN_FACTURA';

        const updateStockSql = 'UPDATE parts SET stock = stock - ? WHERE id = ?';
        db.run(updateStockSql, [quantity, part_id], function (err) {
            if (err) {
                res.status(400).json({ "error": "Failed to update stock" });
                return;
            }

            const insertSaleSql = 'INSERT INTO sales (part_id, quantity, unit_price, total_price, invoice_type) VALUES (?,?,?,?,?)';
            db.run(insertSaleSql, [part_id, quantity, price, total, invoice], function (err) {
                if (err) {
                    console.error("Sale insert failed after stock update!");
                    res.status(500).json({ "error": "Transaction failed" });
                    return;
                }
                // Log Kardex movement
                logMovement({
                    part_id,
                    type: 'VENTA',
                    quantity: -quantity,
                    price,
                    concept: `Venta #${this.lastID} - ${invoice}`
                });
                res.json({
                    "message": "success",
                    "data": {
                        id: this.lastID,
                        part_id,
                        quantity,
                        unit_price: price,
                        total_price: total,
                        invoice_type: invoice,
                        sale_date: new Date()
                    }
                });
            });
        });
    });
});

// POST Return (Refund)
app.post('/api/sales/:id/return', (req, res) => {
    const saleId = req.params.id;

    // Get sale info
    db.get('SELECT * FROM sales WHERE id = ?', [saleId], (err, sale) => {
        if (err || !sale) {
            res.status(404).json({ "error": "Sale not found" });
            return;
        }
        if (sale.refunded) {
            res.status(400).json({ "error": "Already returned" });
            return;
        }

        // Mark as refunded
        db.run('UPDATE sales SET refunded = 1 WHERE id = ?', [saleId], (err) => {
            if (err) {
                res.status(400).json({ "error": "Failed to update sale" });
                return;
            }
            // Increase stock
            db.run('UPDATE parts SET stock = stock + ? WHERE id = ?', [sale.quantity, sale.part_id], (err) => {
                if (err) {
                    console.error("Stock restore failed!");
                }
                // Log Kardex movement
                logMovement({
                    part_id: sale.part_id,
                    type: 'DEVOLUCION',
                    quantity: sale.quantity,
                    price: sale.unit_price,
                    concept: `Devolución de Venta #${saleId}`
                });
                res.json({ "message": "success", "data": { id: saleId, status: "returned" } });
            });
        });
    });
});

// POST Restock (Adjust Stock)
app.post('/api/parts/:id/restock', (req, res) => {
    const partId = req.params.id;
    const { quantity } = req.body;
    console.log(`RESTOCK request: partId=${partId}, quantity=${quantity} (type: ${typeof quantity})`);
    const qtyToAdjust = parseInt(quantity);

    if (isNaN(qtyToAdjust)) {
        res.status(400).json({ "error": `Invalid quantity received: ${quantity} (parsed as ${qtyToAdjust})` });
        return;
    }

    const sql = 'UPDATE parts SET stock = stock + ? WHERE id = ?';
    db.run(sql, [qtyToAdjust, partId], function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        // Log Kardex movement
        logMovement({
            part_id: partId,
            type: qtyToAdjust >= 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
            quantity: qtyToAdjust,
            price: 0,
            concept: `Ajuste manual de stock (${qtyToAdjust >= 0 ? '+' : ''}${qtyToAdjust} unidades)`
        });
        res.json({
            "message": "success",
            "data": { id: partId, adjusted: qtyToAdjust }
        });
    });
});

// POST Bulk Upload from Excel
app.post('/api/parts/bulk-upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        let imported = 0;
        let updatedCount = 0;
        let errors = [];

        // Fetch all existing parts to map by their unique identifier (codigo_producto or name)
        const existingPartsMap = new Map();
        const existingRows = await new Promise((resolve, reject) => {
            db.all("SELECT id, name, codigo_producto, stock FROM parts", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        existingRows.forEach(row => {
            const key = String(row.codigo_producto || row.name || '').trim().toLowerCase();
            if (key) {
                existingPartsMap.set(key, { id: row.id, stock: row.stock });
            }
        });

        await runAsync("BEGIN TRANSACTION;");

        const insertPartSql = 'INSERT INTO parts (familia, codigo, codigo_producto, name, marca, mundial, internal_measure, external_measure, height, description, aplicacion, stock, flange_measure, cost_price, tope, pv_geli) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
        const updatePartSql = 'UPDATE parts SET familia = ?, codigo = ?, name = ?, marca = ?, mundial = ?, internal_measure = ?, external_measure = ?, height = ?, description = ?, aplicacion = ?, stock = ?, flange_measure = ?, cost_price = ?, tope = ?, pv_geli = ? WHERE id = ?';
        const insertMovementSql = 'INSERT INTO stock_movements (part_id, type, quantity, price, balance, concept) VALUES (?,?,?,?,?,?)';

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const index = i;

            // Map Excel columns matching the exact headers
            const familia = row['FAMILIA'] || row['Familia'] || '';
            const codigo_producto = row['CODIGO_PRODUCT'] || row['CODIGO_PRODUC'] || row['Codigo Producto'] || row['Product Code'] || '';
            const marca = row['MARCA'] || row['Marca'] || '';
            const mundial = row['MUNDIAL'] || row['Mundial'] || '';
            const cost_price_val = row['PRECIO BAS'] || row['PRECIO_BAS'] || row['Costo'] || row['Cost'] || 0;
            const cost_price = parseFloat(cost_price_val) || 0;
            const pv_geli = row['PV_GELIPE'] || row['PV GELIPE'] || row['PV_GELI'] || row['PV GELI'] || '';
            const stock_val = row['STO'] || row['Stock'] || 0;
            const stock = parseInt(stock_val) || 0;
            const internal_measure_val = row['MI'] || row['Interna'] || row['Internal'] || 0;
            const internal_measure = parseFloat(internal_measure_val) || 0;
            const external_measure_val = row['ME'] || row['Externa'] || row['External'] || 0;
            const external_measure = parseFloat(external_measure_val) || 0;
            const height_val = row['ALT'] || row['Altura'] || row['Height'] || 0;
            const height = parseFloat(height_val) || 0;
            const flange_measure_val = row['PES'] || row['PE'] || row['Pestaña'] || row['Pestana'] || 0;
            const flange_measure = parseFloat(flange_measure_val) || 0;
            const tope_val = row['TOP'] || row['Tope'] || 0;
            const tope = parseFloat(tope_val) || 0;
            const aplicacion = row['APLICACION'] || row['Aplicación'] || row['Descripción'] || row['Description'] || '';
            const codigo = row['CODIGO'] || row['Codigo'] || row['Code'] || '';

            if (!codigo_producto && !codigo) {
                errors.push(`Fila ${index + 2}: Faltan campos de identificación (Codigo o Codigo Producto)`);
                continue;
            }

            if (isNaN(internal_measure) || isNaN(external_measure) || isNaN(height)) {
                errors.push(`Fila ${index + 2}: Medidas no numéricas detectadas`);
                continue;
            }

            const name = codigo_producto || codigo;
            const lookupKey = String(name).trim().toLowerCase();
            const existing = existingPartsMap.get(lookupKey);

            try {
                if (existing) {
                    // UPDATE existing part details and stock
                    const updateParams = [familia, codigo, name, marca, mundial, internal_measure, external_measure, height, aplicacion, aplicacion, stock, flange_measure, cost_price, tope, pv_geli, existing.id];
                    await runAsync(updatePartSql, updateParams);
                    updatedCount++;

                    // Log stock adjustment if stock has changed
                    const diff = stock - existing.stock;
                    if (diff !== 0) {
                        const movementType = diff > 0 ? 'INGRESO_AJUSTE' : 'EGRESO_AJUSTE';
                        const concept = `Actualización de stock vía Excel (Carga masiva)`;
                        await runAsync(insertMovementSql, [existing.id, movementType, Math.abs(diff), cost_price, stock, concept]);
                    }
                } else {
                    // INSERT new part
                    const partParams = [familia, codigo, name, name, marca, mundial, internal_measure, external_measure, height, aplicacion, aplicacion, stock, flange_measure, cost_price, tope, pv_geli];
                    const partResult = await runAsync(insertPartSql, partParams);
                    const newId = partResult.lastID;
                    imported++;

                    // Log initial movement
                    const concept = `Carga masiva desde Excel (${stock} unidades iniciales)`;
                    await runAsync(insertMovementSql, [newId, 'INGRESO_EXCEL', stock, cost_price, stock, concept]);
                }
            } catch (err) {
                errors.push(`Fila ${index + 2}: ${err.message}`);
            }
        }

        // Clean up uploaded file
        const fs = require('fs');
        try {
            fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
            console.error('Failed to delete uploaded temp file:', unlinkErr);
        }

        // Decide transaction outcome
        if (errors.length > 50) {
            // Roll back if there are way too many errors to ensure database integrity
            await runAsync("ROLLBACK;");
            return res.status(400).json({
                error: 'Demasiados errores en el archivo Excel. Se canceló la carga completa para evitar corrupción.',
                errors: errors.slice(0, 5)
            });
        } else {
            await runAsync("COMMIT;");
            if (errors.length > 0) {
                res.json({
                    message: 'partial_success',
                    imported,
                    updated: updatedCount,
                    errors: errors.slice(0, 5)
                });
            } else {
                res.json({
                    message: 'success',
                    imported,
                    updated: updatedCount
                });
            }
        }

    } catch (error) {
        console.error('Fatal error in bulk-upload:', error);
        try {
            await runAsync("ROLLBACK;");
        } catch (_) {}
        res.status(500).json({ error: error.message });
    }
});

// GET Kardex (stock movements) for a specific part
app.get('/api/kardex/:part_id', (req, res) => {
    const { part_id } = req.params;
    const sql = `
        SELECT sm.*, p.codigo_producto, p.codigo, p.name
        FROM stock_movements sm
        JOIN parts p ON sm.part_id = p.id
        WHERE sm.part_id = ?
        ORDER BY sm.created_at ASC
    `;
    db.all(sql, [part_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'success', data: rows });
    });
});

// Endpoint to purge database (parts, sales and stock_movements)
app.post('/api/database/reset', (req, res) => {
    const { confirmation } = req.body;
    if (confirmation !== 'BORRAR TODO') {
        return res.status(400).json({ error: 'Código de confirmación incorrecto.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        
        let errorOccurred = false;
        
        // Deleting from child tables (sales and stock_movements) first to avoid foreign key constraint violations
        db.run("DELETE FROM stock_movements;", (err) => {
            if (err) errorOccurred = err.message;
        });

        db.run("DELETE FROM sales;", (err) => {
            if (err) errorOccurred = err.message;
        });
        
        db.run("DELETE FROM parts;", (err) => {
            if (err) errorOccurred = err.message;
        });
        
        db.run("DELETE FROM sqlite_sequence WHERE name IN ('parts', 'sales', 'stock_movements');", (err) => {
            if (err) errorOccurred = err.message;
        });

        db.run("COMMIT;", (err) => {
            if (err || errorOccurred) {
                console.error('Error during database purge:', err || errorOccurred);
                db.run("ROLLBACK;");
                return res.status(500).json({ error: 'No se pudo vaciar la base de datos: ' + (err ? err.message : errorOccurred) });
            }
            res.json({ message: 'Base de datos vaciada con éxito.' });
        });
    });
});

// Catch-all route to serve the frontend index.html
app.get('*', (req, res) => {
    const indexPath = path.resolve(__dirname, '..', 'frontend', 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send(`Error loading app: ${err.message}. Path attempted: ${indexPath}`);
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).send(`Server Error: ${err.message}`);
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Database Path: ${process.env.DATABASE_PATH || 'backend/parts.db'}`);
    console.log(`Static Files: ${staticPath}`);
    console.log(`=========================================`);
});
