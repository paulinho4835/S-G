const { execSync } = require('child_process');
const path = require('path');

// Set the winCodeSign directory environment variable to our local, clean copy
process.env.WIN_CODESIGN_DIR = path.resolve(__dirname, 'winCodeSign');

try {
    console.log('--- 🛠️ Iniciando Compilación de la Aplicación ---');
    
    console.log('\n1. Compilando el Frontend (React + Vite)...');
    execSync('npm run build:frontend', { stdio: 'inherit', cwd: __dirname });

    console.log('\n2. Empaquetando la aplicación de Electron...');
    console.log('Utilizando carpeta local de firmas (WIN_CODESIGN_DIR):', process.env.WIN_CODESIGN_DIR);
    
    execSync('npx electron-builder build --win', { stdio: 'inherit', cwd: __dirname });
    
    console.log('\n✨ ¡Proceso completado con éxito! Los ejecutables se encuentran en la carpeta "dist_electron".');
} catch (error) {
    console.error('\n❌ Ocurrió un error durante la compilación:', error.message);
    process.exit(1);
}
