const { app, BrowserWindow,screen } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    const {width, height} = screen.getPrimaryDisplay().workAreaSize
    const mainWindow = new BrowserWindow({
        minWidth: width-100,
        minHeight: height-100,
        center: true,
        webPreferences: {
            nodeIntegration: true
        },
        show: false
    });
    mainWindow.maximize();

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});