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

var mainWindow, loginWindow, contestWindow;

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
                { role: 'toggleDevTools' },
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
                        // app.showAboutPanel();
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
    loginWindow = new BrowserWindow({
        width:336,
        height:592,
        useContentSize: true,
        resizable: false,
        frame: false,
        transparent: true,
        defaultFontSize: 16,
        center: true,
        webPreferences: {
            nodeIntegration: true
        },
        show: false
    });

    loginWindow.webContents.loadFile(path.join(__dirname, 'login.html'));
    // mainWindow.once('ready-to-show', () => {
    //     mainWindow.show();
    // });
    loginWindow.webContents.once('did-finish-load', () => {
        mainWindow=loginWindow;
        loginWindow.show();
        loginWindow.webContents.send('initVisible');
        // loginWindow.webContents.openDevTools();
    });
};

app.setAboutPanelOptions({
    "applicationName":"NOJ Desktop",
    "applicationVersion": app.getVersion(),
    "copyright":"Fangtang Zhixing Network Technology(Nanjing) Co,Ltd.",
    "authors":"John Zhang and various",
    "website":"https://acm.njut.edu.cn",
    "iconPath":"../resources/icon.png"
});
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

async function showContestWindow() {
    await sleep(1000);
    const {width, height} = screen.getPrimaryDisplay().workAreaSize;
    contestWindow = new BrowserWindow({
        minWidth: width - 100,
        minHeight: height - 100,
        width: width - 100,
        height: height - 100,
        backgroundColor: "#fafafa",
        defaultFontSize: 16,
        center: true,
        webPreferences: {
            nodeIntegration: true
        },
        show: false
    });
    loginWindow.close();
    contestWindow.maximize();
    contestWindow.webContents.loadFile(path.join(__dirname, 'contest.html'));
    contestWindow.webContents.once('did-finish-load', () => {
        mainWindow=contestWindow;
        contestWindow.show();
        contestWindow.webContents.send('initVisible');
    });
}

ipcMain.on('closeLogin', (event, arg) => {
    loginWindow.close();
});
ipcMain.on('attemptLogin', (event, arg) => {
    if (isDebug) {
        return showContestWindow();
    }
    request.post({
        url: `${arg.domain}/api/system`
    }, async function optionalCallback(err, httpResponse, body) {
        await sleep(1000);
        if (err) {
            console.error('DOMAIN FAILURE:', err);
            loginWindow.webContents.send('attempedtLogin', {
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
                        loginWindow.webContents.send('attempedtLogin', {
                            code: 2001,
                            desc: "Network Failure.",
                            data: null
                        });
                    } else {
                        console.log('API SUCCESS:');
                        console.log(body);
                        if (!body.data.err) {
                            store.set('user.token', body.data.token);
                            showContestWindow();
                        } else {
                            loginWindow.webContents.send('attempedtLogin', {
                                code: 3002,
                                desc: "Account Login Failure.",
                                data: null
                            });
                        }
                    }
                });
            } else {
                loginWindow.webContents.send('attempedtLogin', {
                    code: 3001,
                    desc: "Product Mismatch or NOJ Server Version Too Low.",
                    data: null
                });
            }
        }
    });
});