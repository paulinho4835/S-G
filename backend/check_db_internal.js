const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

/**
 * Service layer for Database interactions.
 * nodejs-backend-patterns: encapsulation of logic, reusable service.
 */
class PartService {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    /**
     * Ensures connection is open.
     */
    async connect() {
        if (!this.db) {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });
        }
        return this.db;
    }

    /**
     * Gets schema for specified table.
     */
    async getTableSchema(tableName) {
        const db = await this.connect();
        return db.all(`PRAGMA table_info(${tableName})`);
    }

    /**
     * Graceful connection close.
     */
    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

/**
 * Main application runner.
 */
async function main() {
    const dbPath = path.join(__dirname, 'parts.db');
    const partService = new PartService(dbPath);

    try {
        console.log(`Analyzing DB: ${dbPath}`);
        const rows = await partService.getTableSchema('parts');

        if (!rows || rows.length === 0) {
            console.warn("Target table 'parts' does not exist.");
        } else {
            console.log("Schema Analysis:");
            console.table(rows);
        }
    } catch (err) {
        console.error("Execution error:", err.message);
        process.exit(1);
    } finally {
        await partService.close();
        console.log("Cleanup complete.");
    }
}

// Entry point
main();
