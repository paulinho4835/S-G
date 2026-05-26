const sqlite3 = require('../backend/node_modules/sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../frontend/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: Faltan credenciales Supabase');
    process.exit(1);
}

async function restorePvGeli() {
    const db = new sqlite3.Database('./parts_backup.db');

    const query = (sql) => new Promise((resolve, reject) =>
        db.all(sql, (err, rows) => err ? reject(err) : resolve(rows))
    );

    try {
        // 1. Obtener datos del backup
        console.log('📖 Leyendo datos del backup...');
        const backupParts = await query(
            'SELECT codigo_producto, pv_geli FROM parts WHERE pv_geli IS NOT NULL AND pv_geli != ""'
        );

        console.log(`✅ Encontrados ${backupParts.length} productos con PV Gelipe\n`);

        // 2. Obtener todos los productos de Supabase en memoria
        console.log('☁️  Obteniendo productos de Supabase...');
        const allParts = [];
        let offset = 0;
        const FETCH_SIZE = 1000;

        while (true) {
            const response = await fetch(
                `${supabaseUrl}/rest/v1/parts?select=id,codigo_producto&limit=${FETCH_SIZE}&offset=${offset}`,
                {
                    headers: {
                        'apikey': supabaseAnonKey,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            if (!data || data.length === 0) break;

            allParts.push(...data);
            offset += FETCH_SIZE;
            process.stdout.write(`  ${allParts.length} productos obtenidos\r`);
        }

        console.log(`\n✅ Total: ${allParts.length} productos en Supabase\n`);

        // 3. Mapear productos por codigo_producto
        const idMap = new Map();
        allParts.forEach(p => {
            if (p.codigo_producto) {
                idMap.set(p.codigo_producto.toLowerCase(), p.id);
            }
        });

        // 4. Preparar actualizaciones
        const updates = [];
        let found = 0;
        let notFound = 0;

        for (const bp of backupParts) {
            const id = idMap.get((bp.codigo_producto || '').toLowerCase());
            if (id) {
                updates.push({ id, pv_geli: bp.pv_geli });
                found++;
            } else {
                notFound++;
            }
        }

        console.log(`📊 Mapeo:`);
        console.log(`   - Encontrados: ${found}`);
        console.log(`   - No encontrados: ${notFound}\n`);

        // 5. Enviar updates a Supabase
        console.log(`📤 Enviando ${updates.length} actualizaciones a Supabase...`);

        const BATCH = 100;
        let actualizado = 0;
        let errores = 0;

        for (let i = 0; i < updates.length; i += BATCH) {
            const batch = updates.slice(i, i + BATCH);

            const response = await fetch(
                `${supabaseUrl}/rest/v1/parts`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseAnonKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(batch)
                }
            );

            if (response.ok) {
                actualizado += batch.length;
            } else {
                errores += batch.length;
                console.error(`⚠️  Error en lote ${Math.floor(i / BATCH) + 1}: ${response.status}`);
            }

            process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}\r`);
        }

        console.log(`\n\n🎉 ¡Restauración completada!`);
        console.log(`   - Actualizados: ${actualizado}`);
        console.log(`   - Errores: ${errores}\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

restorePvGeli();
