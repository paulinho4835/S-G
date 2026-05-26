const sqlite3 = require('../backend/node_modules/sqlite3').verbose();
const path = require('path');

// Instalar dependencias primero: npm install @supabase/supabase-js sqlite3 dotenv
require('dotenv').config({ path: path.join(__dirname, '../frontend/.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en frontend/.env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function authenticate() {
    const email = process.argv[2];
    const password = process.argv[3];
    if (!email || !password) {
        console.error('Uso: node scripts/migrate-sqlite-to-supabase.js <email> <password>');
        console.error('Ejemplo: node scripts/migrate-sqlite-to-supabase.js admin@retenes.app pochita2024');
        process.exit(1);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error('Auth falló:', error.message); process.exit(1); }
    console.log('✅ Autenticado en Supabase');
}

async function migrate() {
    await authenticate();

    const dbPath = path.join(__dirname, '../backend/parts.db');
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) { console.error('No se pudo abrir parts.db:', err.message); process.exit(1); }
    });

    const query = (sql, params = []) => new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );

    const tables = ['parts', 'sales', 'stock_movements', 'wholesale_orders', 'wholesale_items', 'quotations', 'quotation_items'];
    const counts = {};
    for (const t of tables) {
        const rows = await query(`SELECT COUNT(*) as c FROM ${t}`);
        counts[t] = rows[0].c;
    }
    console.log('📊 Datos en SQLite:', counts);
    console.log('');

    const BATCH = 200;

    // ── Partes ────────────────────────────────────────────────────────────────
    console.log('📦 Migrando parts...');
    const parts = await query('SELECT * FROM parts ORDER BY id');
    const idMap = {};
    for (let i = 0; i < parts.length; i += BATCH) {
        const batch = parts.slice(i, i + BATCH).map(p => ({
            name:             p.name || '',
            internal_measure: p.internal_measure || 0,
            external_measure: p.external_measure || 0,
            height:           p.height || 0,
            description:      p.description || '',
            stock:            p.stock || 0,
            flange_measure:   p.flange_measure || 0,
            familia:          p.familia || '',
            codigo:           p.codigo || '',
            codigo_producto:  p.codigo_producto || '',
            marca:            p.marca || '',
            mundial:          p.mundial || '',
            aplicacion:       p.aplicacion || '',
            cost_price:       p.cost_price || 0,
            tope:             p.tope || 0,
            pv_geli:          p.pv_geli || '',
            created_at:       p.created_at || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('parts').insert(batch).select('id');
        if (error) { console.error('Error parts:', error.message); continue; }
        data.forEach((row, j) => { idMap[parts[i + j].id] = row.id; });
        process.stdout.write(`  ${Math.min(i + BATCH, parts.length)}/${parts.length}\r`);
    }
    console.log(`\n✅ ${parts.length} partes migradas`);

    // ── Stock movements ───────────────────────────────────────────────────────
    console.log('📦 Migrando stock_movements (kardex)...');
    const movements = await query('SELECT * FROM stock_movements ORDER BY id');
    for (let i = 0; i < movements.length; i += BATCH) {
        const batch = movements.slice(i, i + BATCH)
            .filter(m => idMap[m.part_id])
            .map(m => ({
                part_id:    idMap[m.part_id],
                type:       m.type,
                quantity:   m.quantity,
                price:      m.price || 0,
                balance:    m.balance,
                concept:    m.concept || '',
                created_at: m.created_at || new Date().toISOString(),
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('stock_movements').insert(batch);
            if (error) console.error('Error movements:', error.message);
        }
        process.stdout.write(`  ${Math.min(i + BATCH, movements.length)}/${movements.length}\r`);
    }
    console.log(`\n✅ ${movements.length} movimientos migrados`);

    // ── Wholesale orders ──────────────────────────────────────────────────────
    console.log('📦 Migrando wholesale_orders...');
    const orders = await query('SELECT * FROM wholesale_orders ORDER BY id');
    const orderIdMap = {};
    for (let i = 0; i < orders.length; i += BATCH) {
        const batch = orders.slice(i, i + BATCH).map(o => ({
            cliente:      o.cliente,
            subtotal:     o.subtotal || 0,
            total:        o.total || 0,
            invoice_type: o.invoice_type || 'SIN_FACTURA',
            notes:        o.notes || '',
            status:       o.status || 'active',
            order_date:   o.order_date || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('wholesale_orders').insert(batch).select('id');
        if (error) { console.error('Error wholesale_orders:', error.message); continue; }
        data.forEach((row, j) => { orderIdMap[orders[i + j].id] = row.id; });
    }
    console.log(`✅ ${orders.length} pedidos mayoristas migrados`);

    // ── Wholesale items ───────────────────────────────────────────────────────
    console.log('📦 Migrando wholesale_items...');
    const wItems = await query('SELECT * FROM wholesale_items ORDER BY id');
    for (let i = 0; i < wItems.length; i += BATCH) {
        const batch = wItems.slice(i, i + BATCH)
            .filter(wi => orderIdMap[wi.order_id] && idMap[wi.part_id])
            .map(wi => ({
                order_id:    orderIdMap[wi.order_id],
                part_id:     idMap[wi.part_id],
                quantity:    wi.quantity,
                unit_price:  wi.unit_price,
                total_price: wi.total_price,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('wholesale_items').insert(batch);
            if (error) console.error('Error wholesale_items:', error.message);
        }
    }
    console.log(`✅ ${wItems.length} ítems mayoristas migrados`);

    // ── Sales ─────────────────────────────────────────────────────────────────
    console.log('📦 Migrando sales...');
    const sales = await query('SELECT * FROM sales ORDER BY id');
    for (let i = 0; i < sales.length; i += BATCH) {
        const batch = sales.slice(i, i + BATCH)
            .filter(s => idMap[s.part_id])
            .map(s => ({
                part_id:           idMap[s.part_id],
                quantity:          s.quantity,
                unit_price:        s.unit_price || 0,
                total_price:       s.total_price || 0,
                invoice_type:      s.invoice_type || 'SIN_FACTURA',
                sale_date:         s.sale_date || new Date().toISOString(),
                refunded:          !!s.refunded,
                wholesale_order_id: s.wholesale_order_id ? (orderIdMap[s.wholesale_order_id] || null) : null,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('sales').insert(batch);
            if (error) console.error('Error sales:', error.message);
        }
        process.stdout.write(`  ${Math.min(i + BATCH, sales.length)}/${sales.length}\r`);
    }
    console.log(`\n✅ ${sales.length} ventas migradas`);

    // ── Quotations ────────────────────────────────────────────────────────────
    console.log('📦 Migrando quotations...');
    const quotes = await query('SELECT * FROM quotations ORDER BY id');
    const quoteIdMap = {};
    for (let i = 0; i < quotes.length; i += BATCH) {
        const batch = quotes.slice(i, i + BATCH).map(q => ({
            cliente:           q.cliente,
            subtotal:          q.subtotal || 0,
            total:             q.total || 0,
            invoice_type:      q.invoice_type || 'COTIZACION',
            notes:             q.notes || '',
            status:            q.status || 'pending',
            valid_days:        q.valid_days || 7,
            wholesale_order_id: q.wholesale_order_id ? (orderIdMap[q.wholesale_order_id] || null) : null,
            quote_date:        q.quote_date || new Date().toISOString(),
        }));
        const { data, error } = await supabase.from('quotations').insert(batch).select('id');
        if (error) { console.error('Error quotations:', error.message); continue; }
        data.forEach((row, j) => { quoteIdMap[quotes[i + j].id] = row.id; });
    }
    console.log(`✅ ${quotes.length} cotizaciones migradas`);

    // ── Quotation items ───────────────────────────────────────────────────────
    console.log('📦 Migrando quotation_items...');
    const qItems = await query('SELECT * FROM quotation_items ORDER BY id');
    for (let i = 0; i < qItems.length; i += BATCH) {
        const batch = qItems.slice(i, i + BATCH)
            .filter(qi => quoteIdMap[qi.quotation_id] && idMap[qi.part_id])
            .map(qi => ({
                quotation_id: quoteIdMap[qi.quotation_id],
                part_id:      idMap[qi.part_id],
                quantity:     qi.quantity,
                unit_price:   qi.unit_price,
                total_price:  qi.total_price,
            }));
        if (batch.length > 0) {
            const { error } = await supabase.from('quotation_items').insert(batch);
            if (error) console.error('Error quotation_items:', error.message);
        }
    }
    console.log(`✅ ${qItems.length} ítems de cotizaciones migrados`);

    db.close();
    console.log('\n🎉 Migración completada exitosamente!');
    console.log('Verifica los datos en Supabase → Table Editor');
}

migrate().catch(err => { console.error('Fatal:', err); process.exit(1); });
