const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'parts.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('CRITICAL: Error opening database at ' + dbPath + ': ' + err.message);
    } else {
        console.log('SUCCESS: Connected to the SQLite database at:', dbPath);

        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Create parts table
        db.run(`CREATE TABLE IF NOT EXISTS parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            internal_measure REAL NOT NULL,
            external_measure REAL NOT NULL,
            height REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating parts table: ' + err.message);
            } else {
                // Attempt to add new columns if they don't exist
                const columnsToAdd = [
                    'ALTER TABLE parts ADD COLUMN description TEXT',
                    'ALTER TABLE parts ADD COLUMN stock INTEGER DEFAULT 0',
                    'ALTER TABLE parts ADD COLUMN flange_measure REAL DEFAULT 0'
                ];

                columnsToAdd.forEach(query => {
                    db.run(query, (err) => {
                        if (err && !err.message.includes('duplicate column')) {
                            // Ignore
                        }
                    });
                });

                // Performance Indexes
                const indexesToCreate = [
                    'CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name)',
                    'CREATE INDEX IF NOT EXISTS idx_parts_codigo ON parts(codigo)',
                    'CREATE INDEX IF NOT EXISTS idx_parts_codigo_producto ON parts(codigo_producto)',
                    'CREATE INDEX IF NOT EXISTS idx_parts_measures ON parts(internal_measure, external_measure, height)'
                ];

                indexesToCreate.forEach(query => {
                    db.run(query, (err) => {
                        if (err) {
                            console.error('Error creating index: ' + err.message);
                        }
                    });
                });

            }
        });

        // Create sales table
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL,
            total_price REAL,
            invoice_type TEXT,
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            refunded BOOLEAN DEFAULT 0,
            FOREIGN KEY(part_id) REFERENCES parts(id)
        )`, (err) => {
            if (err) {
                console.error('Error creating sales table: ' + err.message);
            }
        });

        // Create kardex (stock_movements) table
        db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL DEFAULT 0,
            balance INTEGER NOT NULL,
            concept TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(part_id) REFERENCES parts(id)
        )`, (err) => {
            if (err) {
                console.error('Error creating stock_movements table: ' + err.message);
            } else {
                db.run('CREATE INDEX IF NOT EXISTS idx_movements_part ON stock_movements(part_id)', () => {});
            }
        });
    }
});

module.exports = db;
