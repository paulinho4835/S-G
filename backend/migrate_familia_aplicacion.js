const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Adding familia and renaming description to aplicacion...");

db.serialize(() => {
    // Add familia column
    db.run('ALTER TABLE parts ADD COLUMN familia VARCHAR(50) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding familia:", err.message);
        } else if (!err) {
            console.log("✓ familia column added");
        } else {
            console.log("✓ familia column already exists");
        }
    });

    // Add aplicacion column
    db.run('ALTER TABLE parts ADD COLUMN aplicacion TEXT DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding aplicacion:", err.message);
        } else if (!err) {
            console.log("✓ aplicacion column added");
        } else {
            console.log("✓ aplicacion column already exists");
        }
    });

    // Copy existing description data to aplicacion
    setTimeout(() => {
        db.run('UPDATE parts SET aplicacion = description WHERE aplicacion = ""', (err) => {
            if (err) {
                console.error("Error copying description to aplicacion:", err.message);
            } else {
                console.log("✓ Migrated existing data from 'description' to 'aplicacion'");
            }
        });
    }, 500);
});

setTimeout(() => {
    db.close();
    console.log("\nMigration completed!");
}, 1000);
