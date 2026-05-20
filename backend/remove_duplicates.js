const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('parts.db');

db.serialize(() => {
    db.run("BEGIN TRANSACTION;");

    // Get count before
    db.get("SELECT COUNT(*) as count FROM parts", [], (err, rowBefore) => {
        if (err) {
            console.error(err);
            db.run("ROLLBACK;");
            db.close();
            return;
        }

        console.log(`Rows before cleanup: ${rowBefore.count}`);

        // Delete duplicates keeping the highest ID (newest entry) for each unique code
        // Since some might have same codigo_producto or same name, let's group by name/codigo_producto
        const deleteSql = `
            DELETE FROM parts
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM parts
                GROUP BY COALESCE(codigo_producto, ''), COALESCE(codigo, ''), COALESCE(name, '')
            )
        `;

        db.run(deleteSql, [], function (err) {
            if (err) {
                console.error("Delete failed:", err);
                db.run("ROLLBACK;");
                db.close();
                return;
            }

            const deletedRows = this.changes;

            db.get("SELECT COUNT(*) as count FROM parts", [], (err, rowAfter) => {
                if (err) {
                    console.error(err);
                    db.run("ROLLBACK;");
                    db.close();
                    return;
                }

                db.run("COMMIT;", (err) => {
                    if (err) {
                        console.error("Commit failed:", err);
                        db.run("ROLLBACK;");
                    } else {
                        console.log(`Deduplication successful!`);
                        console.log(`Deleted rows: ${deletedRows}`);
                        console.log(`Remaining rows: ${rowAfter.count}`);
                    }
                    db.close();
                });
            });
        });
    });
});
