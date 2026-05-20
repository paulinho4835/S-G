const xlsx = require('xlsx');
const path = require('path');

const excelPath = 'C:\\Users\\pauli\\Downloads\\productos.xlsx';
try {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`Excel Total Rows: ${data.length}`);
    
    // Find rows where MI is between 25 and 27
    const matches = data.filter(row => {
        const val = parseFloat(row['MI']);
        return !isNaN(val) && val >= 25 && val <= 27;
    });

    console.log(`Found ${matches.length} rows in Excel with 'MI' between 25 and 27.`);
    console.table(matches.map(row => ({
        Codigo: row['CODIGO'] || row['codigo'] || '',
        Nombre: row['NOMBRE'] || row['nombre'] || '',
        MI: row['MI'] || '',
        ME: row['ME'] || '',
        ALT: row['ALT'] || ''
    })));
} catch (err) {
    console.error('Error reading Excel:', err);
}
