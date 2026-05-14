const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Migrating Sales Table at:", dbPath);

db.serialize(() => {
    const columns = [
        'ALTER TABLE sales ADD COLUMN unit_price REAL',
        'ALTER TABLE sales ADD COLUMN invoice_type TEXT'
    ];

    columns.forEach(query => {
        console.log("Running:", query);
        db.run(query, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log("Column already exists (skipped).");
                } else {
                    console.error("Error adding column:", err.message);
                }
            } else {
                console.log("Column added successfully.");
            }
        });
    });
});

db.close();
