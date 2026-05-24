// exportar-catalogo.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const candidates = [
  path.resolve(__dirname, 'backend', 'parts.db'),
  path.resolve(__dirname, 'parts_backup.db'),
];

const dbPath = candidates.find(p => fs.existsSync(p));
if (!dbPath) {
  console.error('ERROR: No se encontró ningún archivo de base de datos.');
  console.error('Buscado en:', candidates.join(', '));
  process.exit(1);
}

console.log('Usando base de datos:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error abriendo DB:', err.message);
    process.exit(1);
  }
});

const sql = `
  SELECT
    id,
    codigo,
    codigo_producto,
    marca,
    familia,
    aplicacion,
    internal_measure,
    external_measure,
    height,
    flange_measure,
    stock,
    pv_geli,
    mundial
  FROM parts
  ORDER BY codigo_producto
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Error consultando partes:', err.message);
    process.exit(1);
  }

  const output = {
    exported_at: new Date().toISOString(),
    count: rows.length,
    products: rows,
  };

  const outPath = path.resolve(__dirname, 'catalogo.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✓ Exportados ${rows.length} productos → ${outPath}`);
  db.close();
});
