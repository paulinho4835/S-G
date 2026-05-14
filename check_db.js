const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'backend/parts.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(parts)", (err, rows) => {
        if (err) {
            console.error("Error checking schema:", err);
            return;
        }
        console.log("Schema for 'parts' table:");
        console.table(rows);
    });
});

db.close();
