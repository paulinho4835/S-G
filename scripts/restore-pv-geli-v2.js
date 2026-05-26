const sqlite3 = require('../backend/node_modules/sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../frontend/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restorePvGeli() {
    const db = new sqlite3.Database('./parts_backup.db');

    const query = (sql, params = []) => new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );

    try {
        // Obtener todos los productos del backup con pv_geli
        const backupParts = await query(
            'SELECT codigo_producto, codigo, pv_geli FROM parts WHERE pv_geli IS NOT NULL AND pv_geli != ""'
        );

        console.log(`📦 Encontrados ${backupParts.length} productos con PV Gelipe en backup`);

        // Crear lista de updates para buscar por codigo_producto
        const updates = [];
        const codigosProducto = [];

        for (const bp of backupParts) {
            if (bp.codigo_producto) {
                codigosProducto.push(bp.codigo_producto);
                updates.push({
                    codigo_producto: bp.codigo_producto,
                    pv_geli: bp.pv_geli
                });
            }
        }

        console.log(`\n🔍 Buscando ${codigosProducto.length} productos en Supabase por codigo_producto...`);

        // Procesar por lotes
        const BATCH = 50;
        let actualizado = 0;
        let noEncontrado = 0;

        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);
            const codigosLote = batch.map(u => u.codigo_producto);

            // Obtener IDs de Supabase
            const { data: foundParts, error: queryErr } = await supabase
                .from('parts')
                .select('id, codigo_producto')
                .in('codigo_producto', codigosLote);

            if (queryErr) {
                console.error('Error en query:', queryErr);
                continue;
            }

            // Actualizar cada uno encontrado
            for (const found of foundParts || []) {
                const update = batch.find(u => u.codigo_producto === found.codigo_producto);
                if (update) {
                    const { error: updateErr } = await supabase
                        .from('parts')
                        .update({ pv_geli: update.pv_geli })
                        .eq('id', found.id);

                    if (!updateErr) {
                        actualizado++;
                    } else {
                        console.error(`Error actualizando ${found.codigo_producto}:`, updateErr);
                    }
                }
            }

            noEncontrado += codigosLote.length - (foundParts?.length || 0);
            process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length} (${actualizado} actualizados)\r`);
        }

        console.log(`\n\n✅ Restauración completada!`);
        console.log(`   - Actualizados: ${actualizado}`);
        console.log(`   - No encontrados: ${noEncontrado}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        db.close();
    }
}

restorePvGeli();
