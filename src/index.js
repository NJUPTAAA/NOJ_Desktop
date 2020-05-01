const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('request');
const Store = require('electron-store');
const store = new Store();

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
} 

if (require('electron-squirrel-startup')) {
    app.quit();
}

var mainWindow;

const createWindow = () => {
    const {width, height} = screen.getPrimaryDisplay().workAreaSize
    mainWindow = new BrowserWindow({
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

ipcMain.on('attemptLogin', (event, arg) => {
    // mainWindow.webContents.send('changeButtonStage', 'start');
    request.post({
        url:`${arg.domain}/api/system`
    }, async function optionalCallback(err, httpResponse, body) {
        await sleep(1000);
        if (err) {
            console.error('DOMAIN FAILURE:', err);
            mainWindow.webContents.send('attempedtLogin', {
                code: 2000,
                desc: "Domain Failure.",
                data: null
            });
        } else {
            console.log('DOMAIN SUCCESS:');
            console.log(body);
            if(body.product=="NOJ" && body.version >= "0.4.0") {
                request.post({
                    url:`${arg.domain}/api/auth`,
                    form: {
                        email: arg.email,
                        password: arg.password
                    }
                }, async function optionalCallback(err, httpResponse, body) {
                    await sleep(1000);
                    if (err) {
                        console.error('API FAILURE:', err);
                        mainWindow.webContents.send('attempedtLogin', {
                            code: 2001,
                            desc: "Network Failure.",
                            data: null
                        });
                    } else {
                        console.log('API SUCCESS:');
                        console.log(body);
                        if(true) {
                            store.set('user.token', body.data.token);
                            mainWindow.webContents.send('attempedtLogin', {
                                code: 200,
                                desc: "Account Logined.",
                                data: null
                            });
                        } else {
                            mainWindow.webContents.send('attempedtLogin', {
                                code: 3002,
                                desc: "Account Login Failure.",
                                data: null
                            });
                        }
                    }
                });
            } else {
                mainWindow.webContents.send('attempedtLogin', {
                    code: 3001,
                    desc: "Product Mismatch or NOJ Server Version Too Low.",
                    data: null
                });
            }
        }
    });
});