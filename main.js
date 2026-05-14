const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let serverProcess;
let mainWindow;

function startBackend() {
    // Determine path to server
    const serverPath = path.join(__dirname, 'backend', 'server.js');
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'parts.db');
    const uploadsPath = path.join(userDataPath, 'uploads');

    // Ensure uploads directory exists
    const fs = require('fs');
    if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
    }

    // Data Migration: Copy bundled DB to userData if it doesn't exist or is empty
    const bundledDbPath = path.join(__dirname, 'backend', 'parts.db');
    let shouldCopy = false;

    if (!fs.existsSync(dbPath)) {
        console.log('Database does not exist in userData. Copying bundled DB...');
        shouldCopy = true;
    } else {
        const stats = fs.statSync(dbPath);
        // An empty SQLite DB with schema is ~12-16KB. Our real DB is ~1MB.
        // If it's less than 50KB, it's likely just an empty shell.
        if (stats.size < 50000) {
            console.log(`Database exists but is suspiciously small (${stats.size} bytes). Overwriting with bundled DB...`);
            shouldCopy = true;
        } else {
            console.log('Database already exists in userData and seems valid. Size:', stats.size);
        }
    }

    if (shouldCopy && fs.existsSync(bundledDbPath)) {
        try {
            fs.copyFileSync(bundledDbPath, dbPath);
            console.log('Database successfully copied to:', dbPath);
        } catch (err) {
            console.error('CRITICAL: Failed to copy database:', err);
        }
    }

    console.log('UserData Path:', userDataPath);
    console.log('Starting backend at:', serverPath);

    // Start backend process using Electron's Node.js
    serverProcess = spawn(process.execPath, [serverPath], {
        cwd: path.join(__dirname, 'backend'),
        env: {
            ...process.env,
            PORT: 3005,
            ELECTRON_RUN_AS_NODE: '1',
            DATABASE_PATH: dbPath,
            UPLOADS_PATH: uploadsPath
        }
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start backend process:', err);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, // Default fallback
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        show: false, // Don't show until maximized
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "La casa de los retenes S&G",
        backgroundColor: '#0f172a'
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });


    // In dev, load Vite dev server
    // In prod, load built files from server or local
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // We will make server.js serve the static files on port 3005
        mainWindow.loadURL('http://localhost:3005');
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    startBackend();
    // Wait for backend to be ready before creating window
    setTimeout(() => {
        createWindow();
        if (mainWindow) {
            mainWindow.webContents.on('did-fail-load', () => {
                console.error('Window failed to load. Retrying in 2s...');
                setTimeout(() => mainWindow.reload(), 2000);
            });
        }
    }, 3000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) serverProcess.kill();
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('exit', () => {
    if (serverProcess) serverProcess.kill();
});
