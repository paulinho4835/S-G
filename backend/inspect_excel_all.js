const xlsx = require('xlsx');
const path = require('path');

const excelPath = 'C:\\Users\\pauli\\Downloads\\productos.xlsx';
try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let count = 0;
    const matches = [];

    data.forEach((row, index) => {
        for (const key in row) {
            const val = String(row[key]);
            if (val.includes('25.8') || val.includes('25,8') || val.includes('25.9') || val.includes('25,9')) {
                matches.push({ index: index + 2, key, val, row });
                count++;
                break;
            }
        }
    });

    console.log(`Excel Search Results: Found ${count} rows containing 25.8/25.9 anywhere.`);
    if (matches.length > 0) {
        console.table(matches.slice(0, 30).map(m => ({
            Row: m.index,
            Column: m.key,
            Value: m.val,
            Codigo: m.row['CODIGO'] || m.row['codigo'] || '',
            MI: m.row['MI'] || '',
            ME: m.row['ME'] || '',
            ALT: m.row['ALT'] || ''
        })));
    }
} catch (err) {
    console.error('Error reading Excel:', err);
}
