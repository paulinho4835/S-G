const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'parts.db');
const db = new sqlite3.Database(dbPath);

console.log("Adding new product fields to parts table...");

db.serialize(() => {
    // Add codigo column (short code)
    db.run('ALTER TABLE parts ADD COLUMN codigo VARCHAR(50) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding codigo:", err.message);
        } else if (!err) {
            console.log("✓ codigo column added");
        }
    });

    // Add codigo_producto column (rename from name later)
    db.run('ALTER TABLE parts ADD COLUMN codigo_producto VARCHAR(100) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding codigo_producto:", err.message);
        } else if (!err) {
            console.log("✓ codigo_producto column added");
        }
    });

    // Add marca column (brand)
    db.run('ALTER TABLE parts ADD COLUMN marca VARCHAR(50) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding marca:", err.message);
        } else if (!err) {
            console.log("✓ marca column added");
        }
    });

    // Add mundial column
    db.run('ALTER TABLE parts ADD COLUMN mundial VARCHAR(50) DEFAULT ""', (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error("Error adding mundial:", err.message);
        } else if (!err) {
            console.log("✓ mundial column added");
        }
    });

    // Copy existing 'name' data to 'codigo_producto'
    setTimeout(() => {
        db.run('UPDATE parts SET codigo_producto = name WHERE codigo_producto = ""', (err) => {
            if (err) {
                console.error("Error copying name to codigo_producto:", err.message);
            } else {
                console.log("✓ Migrated existing data from 'name' to 'codigo_producto'");
            }
        });
    }, 500);
});

setTimeout(() => {
    db.close();
    console.log("\nMigration completed!");
}, 1000);
