const { app, BrowserView, BrowserWindow, screen, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('request');
const Store = require('electron-store');
const store = new Store();
const isDebug = app.isPackaged === false;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

if (require('electron-squirrel-startup')) {
    app.quit();
}

var mainWindow, loginView, contestView;

const createMenu = () => {
    const isMac = process.platform === 'darwin';

    const template = [
        // { role: 'appMenu' }
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        // { role: 'fileMenu' }
        {
            label: 'File',
            submenu: [
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        // { role: 'editMenu' }
        // { role: 'viewMenu' }
        ...(isDebug ? [{
            label: 'Debugger',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'Ctrl+Shift+I',
                    click() {
                        mainWindow.getBrowserView().webContents.openDevTools();
                    }
                },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }] : []),

        // { role: 'windowMenu' }
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                        { role: 'close' }
                    ])
            ]
        },
        {
            label: 'About',
            submenu: [
                {
                    label: 'About NOJ Desktop',
                    click() {
                        dialog.showMessageBoxSync(mainWindow, {
                            type: "info",
                            title: "About",
                            message: "NOJ Desktop [Stable Version]",
                            detail: "Version: 1.0.0\nAuthor: John Zhang and various\nCopyright (C) 2020 Fangtang Zhixing Network Technology(Nanjing) Co,Ltd."
                        });
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Open-Source',
                    click: async () => {
                        await shell.openExternal('https://github.com/NJUPTAAA/NOJ_Desktop');
                    }
                },
                {
                    label: 'Report Issues',
                    click: async () => {
                        await shell.openExternal('https://github.com/NJUPTAAA/NOJ_Desktop/issues');
                    }
                }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

const createWindow = () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    mainWindow = new BrowserWindow({
        minWidth: width - 100,
        minHeight: height - 100,
        title: "NOJ Desktop [Stable]",
        center: true,
        webPreferences: {
            nodeIntegration: true
        },
        show: false
    });
    mainWindow.maximize();

    loginView = new BrowserView({
        center: true,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.setBrowserView(loginView);
    loginView.webContents.loadFile(path.join(__dirname, 'login.html'));
    loginView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true });
    loginView.setBounds({ width: mainWindow.getContentSize()[0], height: mainWindow.getContentSize()[1], x: 0, y: 0 });
    // mainWindow.once('ready-to-show', () => {
    //     mainWindow.show();
    // });
    loginView.webContents.once('did-finish-load', () => {
        mainWindow.show();
    });
};

app.on('ready', createMenu);
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

async function showContestView() {
    await sleep(1000);
    mainWindow.hide();
    contestView = new BrowserView({
        center: true,
        webPreferences: {
            nodeIntegration: true
        }
    });
    contestView.webContents.loadFile(path.join(__dirname, 'contest.html'));
    contestView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true });
    contestView.setBounds({ width: mainWindow.getContentSize()[0], height: mainWindow.getContentSize()[1], x: 0, y: 0 });
    mainWindow.setBrowserView(contestView);
    // fixed view bugs
    contestView.webContents.once('did-finish-load', async () => {
        mainWindow.show();
    });
}

ipcMain.on('attemptLogin', (event, arg) => {
    if (isDebug) {
        return showContestView();
    }
    request.post({
        url: `${arg.domain}/api/system`
    }, async function optionalCallback(err, httpResponse, body) {
        await sleep(1000);
        if (err) {
            console.error('DOMAIN FAILURE:', err);
            loginView.webContents.send('attempedtLogin', {
                code: 2000,
                desc: "Domain Failure.",
                data: null
            });
        } else {
            console.log('DOMAIN SUCCESS:');
            console.log(body);
            if (typeof body.product !== 'undefined' && body.product == "NOJ" && typeof body.version !== 'undefined' && body.version >= "0.4.0") {
                request.post({
                    url: `${arg.domain}/api/auth`,
                    form: {
                        email: arg.email,
                        password: arg.password
                    }
                }, async function optionalCallback(err, httpResponse, body) {
                    await sleep(1000);
                    if (err) {
                        console.error('API FAILURE:', err);
                        loginView.webContents.send('attempedtLogin', {
                            code: 2001,
                            desc: "Network Failure.",
                            data: null
                        });
                    } else {
                        console.log('API SUCCESS:');
                        console.log(body);
                        if (!body.data.err) {
                            store.set('user.token', body.data.token);
                            showContestView();
                        } else {
                            loginView.webContents.send('attempedtLogin', {
                                code: 3002,
                                desc: "Account Login Failure.",
                                data: null
                            });
                        }
                    }
                });
            } else {
                loginView.webContents.send('attempedtLogin', {
                    code: 3001,
                    desc: "Product Mismatch or NOJ Server Version Too Low.",
                    data: null
                });
            }
        }
    });
});