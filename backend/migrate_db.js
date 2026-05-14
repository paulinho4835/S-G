const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Migrating DB at:", dbPath);

db.serialize(() => {
    const columns = [
        'ALTER TABLE parts ADD COLUMN description TEXT',
        'ALTER TABLE parts ADD COLUMN stock INTEGER DEFAULT 0',
        'ALTER TABLE parts ADD COLUMN flange_measure REAL DEFAULT 0'
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
