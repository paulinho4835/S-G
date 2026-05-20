const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('parts.db');
db.all('SELECT DISTINCT internal_measure FROM parts ORDER BY CAST(internal_measure AS REAL) ASC', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(rows.map(r => r.internal_measure).join(', '));
    db.close();
});
