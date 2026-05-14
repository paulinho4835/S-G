const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Adding pv_geli column to parts table...");

db.serialize(() => {
    db.run('ALTER TABLE parts ADD COLUMN pv_geli VARCHAR(50) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding pv_geli:", err.message);
        } else if (!err) {
            console.log("✓ pv_geli column added");
        } else {
            console.log("✓ pv_geli column already exists");
        }
    });
});

setTimeout(() => {
    db.close();
    console.log("\nMigration completed!");
}, 1000);
