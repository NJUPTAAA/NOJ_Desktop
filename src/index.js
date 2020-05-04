const { app, BrowserView, BrowserWindow, screen, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('request');
const Store = require('electron-store');
const store = new Store();
const isDebug = app.isPackaged === false;
const url = require("url");
var compareVersions = require('compare-versions');
var generalDomain = false;
var userToken;
var userInfo;
var cid;
var tillBegin;
var preCounter,contestCounter;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function tryParseJSON(jsonString){
    try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === "object") {
            return o;
        }
    }
    catch (e) { }

    return false;
};

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
    let parseRet = url.parse(arg.domain);
    // console.log(parseRet);
    if(!['https:','http:'].includes(parseRet.protocol) || parseRet.hostname === null){
        return loginWindow.webContents.send('attempedtLogin', {
            code: 2001,
            desc: "Domain Portocol Error.",
            data: null
        });
    }
    var realDomain = `${parseRet.protocol}//${parseRet.hostname}`;
    console.log(realDomain);
    request.post({
        url: `${realDomain}/api/system/info`
    }, async function optionalCallback(err, httpResponse, body) {
        await sleep(1000);
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return loginWindow.webContents.send('attempedtLogin', {
                code: 2000,
                desc: "Domain Failure.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${realDomain}/api/system/info`);
        var domainRet = tryParseJSON(body);
        if(domainRet === false) {
            return loginWindow.webContents.send('attempedtLogin', {
                code: 3001,
                desc: "Product Mismatch or NOJ Version Too Low.",
                data: null
            });
        }
        console.log(domainRet);
        if (!(typeof domainRet.ret !== 'undefined' && typeof domainRet.ret.product !== 'undefined' && ["NOJ", "NOJ Slim"].includes(domainRet.ret.product) && typeof domainRet.ret.version !== 'undefined' && compareVersions(domainRet.ret.version.split('-')[0], "0.4.0")>=0 )) {
            return loginWindow.webContents.send('attempedtLogin', {
                code: 3001,
                desc: "Product Mismatch or NOJ Version Too Low.",
                data: null
            });
        }
        // return loginWindow.webContents.send('attempedtLogin', {
        //     code: 1000,
        //     desc: "Debugging Failure.",
        //     data: null
        // });
        request.post({
            url: `${arg.domain}/api/account/login`,
            form: {
                email: arg.email,
                password: arg.password
            }
        }, async function optionalCallback(err, httpResponse, body) {
            await sleep(1000);
            if (err) {
                console.error('API FAILURE:', err);
                return loginWindow.webContents.send('attempedtLogin', {
                    code: 2001,
                    desc: "Network Failure.",
                    data: null
                });
            }
            console.log('API SUCCESS:');
            var loginRet = tryParseJSON(body);
            if(loginRet === false) {
                return loginWindow.webContents.send('attempedtLogin', {
                    code: 1001,
                    desc: "API Format Error.",
                    data: null
                });
            }
            console.log(loginRet);
            try{
                if (loginRet.success === false) {
                    return loginWindow.webContents.send('attempedtLogin', {
                        code: 3002,
                        desc: loginRet.message,
                        data: null
                    });
                }
                if (loginRet.success === true && !loginRet.ret.user.contest_account) {
                    return loginWindow.webContents.send('attempedtLogin', {
                        code: 3003,
                        desc: "Please use a contest account.",
                        data: null
                    });
                }
                cid = loginRet.ret.user.contest_account;
                // store.set('general.domain', realDomain);
                // store.set('user.token', loginRet.ret.token);
                // store.set('user.info', loginRet.ret.user);
                generalDomain = realDomain;
                userToken = loginRet.ret.token;
                userInfo = loginRet.ret.user;
                showContestWindow();
            }
            catch (e) {
                loginWindow.webContents.send('attempedtLogin', {
                    code: 1000,
                    desc: "Unknown Error.",
                    data: null
                });
            }
        });
    });
});

ipcMain.on('updateContestBasic', (event, arg) => {
    request.post({
        url: `${generalDomain}/api/contest/info`,
        form: {
            cid: cid
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('updatedContestBasic', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/info`);
        let contestInfoRet = tryParseJSON(body);
        if(contestInfoRet === false){
            return contestWindow.webContents.send('updatedContestBasic', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            tillBegin = parseInt((new Date(contestInfoRet.ret.begin_time) - new Date())/1000);
            tillEnd = parseInt((new Date(contestInfoRet.ret.end_time) - new Date())/1000);
            clearInterval(preCounter);
            clearInterval(contestCounter);
            if(tillBegin > 0) {
                // not begin, reset tillEnd
                tillEnd = parseInt((new Date(contestInfoRet.ret.end_time)-new Date(contestInfoRet.ret.begin_time))/1000);
                preCounting();
            } else {
                // begin
                if(tillEnd < 0) {
                    // ended
                    contestWindow.webContents.send('updatedContestTimer', {
                        stage: "after",
                        timer: 0
                    });
                } else {
                    // on-going
                    contestCounting();
                }
            }
            return contestWindow.webContents.send('updatedContestBasic', {
                code: 200,
                desc: "Success.",
                data: {
                    name: contestInfoRet.ret.name,
                    img: contestInfoRet.ret.img,
                    begin_time: contestInfoRet.ret.begin_time,
                    end_time: contestInfoRet.ret.end_time,
                    length: parseInt((new Date(contestInfoRet.ret.end_time)-new Date(contestInfoRet.ret.begin_time))/1000),
                    problems: contestInfoRet.ret.problems,
                    organizer: contestInfoRet.ret.organizer,
                    description_parsed: contestInfoRet.ret.description,
                    badges: contestInfoRet.ret.badges
                }
            });
        }
        catch (e) {
            return contestWindow.webContents.send('updatedContestBasic', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

function preCounting(){
    contestWindow.webContents.send('updatedContestTimer', {
        stage: "pre",
        timer: tillBegin
    });
    preCounter = setInterval(() => {
        contestWindow.webContents.send('updatedContestTimer', {
            stage: "pre",
            timer: tillBegin
        });
        tillBegin--;
        console.log(`Starting at ${tillBegin}`);
        if(tillBegin<=0){
            contestCounting();
            clearInterval(preCounter);
        }
    }, 1000);
}

function contestCounting(){
    contestWindow.webContents.send('updatedContestTimer', {
        stage: "ongoing",
        timer: tillEnd
    });
    contestCounter = setInterval(() => {
        contestWindow.webContents.send('updatedContestTimer', {
            stage: "ongoing",
            timer: tillEnd
        });
        tillEnd--;
        console.log(`Ending at ${tillEnd}`);
        if(tillEnd<=0){
            contestWindow.webContents.send('updatedContestTimer', {
                stage: "after",
                timer: 0
            });
            clearInterval(contestCounter);
        }
    }, 1000);
}

ipcMain.on('updateContestStatus', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/status`,
        form: {
            cid: cid,
            filter: {
                account: arg.filter.account,
                problem: arg.filter.problem,
                result: arg.filter.result
            },
            page: arg.page
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('updatedContestStatus', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/status`);
        let contestStatusRet = tryParseJSON(body);
        if(contestStatusRet === false){
            return contestWindow.webContents.send('updatedContestStatus', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            return contestWindow.webContents.send('updatedContestStatus', {
                code: 200,
                desc: "Success.",
                data: contestStatusRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('updatedContestStatus', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});