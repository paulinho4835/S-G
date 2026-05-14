const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Adding cost_price column to parts table...");

db.serialize(() => {
    const query = 'ALTER TABLE parts ADD COLUMN cost_price REAL DEFAULT 0';

    console.log("Running:", query);
    db.run(query, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log("Column already exists (skipped).");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("cost_price column added successfully.");
        }
    });
});

db.close();
