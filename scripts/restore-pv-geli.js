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

        // Obtener todos los productos de Supabase (sin filtros, con RLS bypass si es posible)
        const { data: supabaseParts, error: err } = await supabase
            .from('parts')
            .select('id, codigo_producto, codigo')
            .limit(10000); // Aumentar límite

        if (err) {
            console.error('Error obteniendo datos de Supabase:', err);
            throw err;
        }

        console.log(`☁️  Obtenidos ${supabaseParts?.length || 0} productos de Supabase`);

        // Crear mapeo: codigo_producto -> supabase id
        const idMap = {};
        supabaseParts.forEach(p => {
            const key = (p.codigo_producto || p.codigo || '').toLowerCase();
            if (key) idMap[key] = p.id;
        });

        // Preparar actualizaciones
        const updates = [];
        const notFound = [];

        for (const bp of backupParts) {
            const key = (bp.codigo_producto || bp.codigo || '').toLowerCase();
            if (idMap[key]) {
                updates.push({
                    id: idMap[key],
                    pv_geli: bp.pv_geli
                });
            } else {
                notFound.push(bp.codigo_producto || bp.codigo);
            }
        }

        console.log(`\n✅ Coincidencias encontradas: ${updates.length}`);
        if (notFound.length > 0) {
            console.log(`⚠️  No encontrados en Supabase: ${notFound.length}`);
        }

        // Actualizar en lotes
        const BATCH = 100;
        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);
            const { error: updateErr } = await supabase
                .from('parts')
                .upsert(batch, { onConflict: 'id' });

            if (updateErr) {
                console.error('Error actualizando:', updateErr);
                continue;
            }

            process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}\r`);
        }

        console.log(`\n🎉 Restauración completada: ${updates.length} productos actualizados`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        db.close();
    }
}

restorePvGeli();
