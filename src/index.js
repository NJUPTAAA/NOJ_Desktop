const { app, BrowserView, BrowserWindow, screen, ipcMain, Menu, dialog, shell, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('request');
const Store = require('electron-store');
const store = new Store();
const isDebug = app.isPackaged === false;
const url = require("url");
const NOJFileType = require("./NOJFileType");
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

var mainWindow, loginWindow, contestWindow, submissionModel;

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
                    icon: nativeImage.createFromPath(__dirname + '/resources/icons/noj-blue.png').resize({width:16}),
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
                    icon: nativeImage.createFromPath(__dirname + '/resources/icons/github.png').resize({width:16}),
                    click: async () => {
                        await shell.openExternal('https://github.com/NJUPTAAA/NOJ_Desktop');
                    }
                },
                {
                    label: 'Report Issues',
                    icon: nativeImage.createFromPath(__dirname + '/resources/icons/bugs.png').resize({width:16}),
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
        show: false,
        maximizable: false
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

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
    app.on('ready', createMenu);
    app.on('ready', createWindow);
}

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
    // submissionModel = new BrowserWindow({
    //     width: parseInt(width*0.7),
    //     height: parseInt(height*0.7),
    //     resizable: false,
    //     defaultFontSize: 16,
    //     center: true,
    //     webPreferences: {
    //         nodeIntegration: true
    //     },
    //     show: false,
    //     parent: contestWindow,
    //     modal: true,
    //     useContentSize: true,
    //     // frame: false,
    //     // transparent: true,
    //     // hasShadow: true,
    // });
    // submissionModel.webContents.loadFile(path.join(__dirname, 'submissionDetail.html'));
    // submissionModel.on('close', (event) => {
    //     event.preventDefault();
    //     console.log("close");
    //     submissionModel.hide();
    // });
    loginWindow.close();
    contestWindow.maximize();
    contestWindow.webContents.loadFile(path.join(__dirname, 'contest.html'));
    contestWindow.webContents.once('did-finish-load', () => {
        mainWindow=contestWindow;
        contestWindow.show();
        contestWindow.webContents.send('initVisible',userInfo);
    });
}

ipcMain.on('closeLogin', (event, arg) => {
    loginWindow.close();
});

ipcMain.on('closeSubmission', (event, arg) => {
    submissionModel.close();
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
            // console.log(httpResponse);
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
                request.post({
                    url: `${generalDomain}/api/contest/info`,
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${userToken}`,
                    },
                    form: {
                        cid: cid
                    }
                }, function optionalCallback(err, httpResponse, body) {
                    if (err) {
                        console.error('REQUEST FAILURE:', err);
                        return loginWindow.webContents.send('attempedtLogin', {
                            code: 2003,
                            desc: "Network Error.",
                            data: null
                        });
                    }
                    console.log('REQUEST SUCCESS:');
                    console.log(`${generalDomain}/api/contest/info`);
                    let contestInfoRet = tryParseJSON(body);
                    if(contestInfoRet === false){
                        return loginWindow.webContents.send('attempedtLogin', {
                            code: 3100,
                            desc: "API Response Error, Please Contact Site Admin.",
                            data: null
                        });
                    }
                    try{
                        console.log(contestInfoRet);
                        if(contestInfoRet.success === false){
                            return loginWindow.webContents.send('attempedtLogin', {
                                code: 4000,
                                desc: contestInfoRet.message,
                                data: contestInfoRet.err
                            });
                        }
                        if(contestInfoRet.ret.badges.desktop === false){
                            return loginWindow.webContents.send('attempedtLogin', {
                                code: 5000,
                                desc: "The Contest doesn't support NOJ Desktop",
                                data: null
                            });
                        }
                        showContestWindow();
                    }
                    catch (e) {
                        return loginWindow.webContents.send('attempedtLogin', {
                            code: 3100,
                            desc: "API Response Error, Please Contact Site Admin.",
                            data: null
                        });
                    }
                });
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
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
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
            console.log(contestInfoRet);
            if(contestInfoRet.success === false){
                return contestWindow.webContents.send('updatedContestBasic', {
                    code: 4000,
                    desc: contestInfoRet.message,
                    data: contestInfoRet.err
                });
            }
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
        try{
            contestWindow.webContents.send('updatedContestTimer', {
                stage: "pre",
                timer: tillBegin
            });
        }catch(e){
            
        }
        tillBegin--;
        console.log(`Starting at ${tillBegin}`);
        if(tillBegin<=0){
            contestCounting();
            clearInterval(preCounter);
        }
    }, 1000);
}

function contestCounting(){
    try{
        contestWindow.webContents.send('updatedContestTimer', {
            stage: "ongoing",
            timer: tillEnd
        });
    }catch(e){
        
    }
    contestCounter = setInterval(() => {
        try{
            contestWindow.webContents.send('updatedContestTimer', {
                stage: "ongoing",
                timer: tillEnd
            });
        }catch(e){
            
        }
        tillEnd--;
        console.log(`Ending at ${tillEnd}`);
        if(tillEnd<=0){
            try{
                contestWindow.webContents.send('updatedContestTimer', {
                    stage: "after",
                    timer: 0
                });
            }catch(e){
                
            }
            clearInterval(contestCounter);
        }
    }, 1000);
}

ipcMain.on('updateContestStatus', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/status`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
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
        console.log(contestStatusRet);
        if(contestStatusRet === false){
            return contestWindow.webContents.send('updatedContestStatus', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            if(contestStatusRet.success === false){
                return contestWindow.webContents.send('updatedContestStatus', {
                    code: 4000,
                    desc: contestStatusRet.message,
                    data: contestStatusRet.err
                });
            }
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

ipcMain.on('updateContestScoreBoard', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/scoreboard`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('updatedContestScoreBoard', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/scoreboard`);
        let contestScoreBoardRet = tryParseJSON(body);
        if(contestScoreBoardRet === false){
            return contestWindow.webContents.send('updatedContestScoreBoard', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            if(contestScoreBoardRet.success === false){
                return contestWindow.webContents.send('updatedContestScoreBoard', {
                    code: 4000,
                    desc: contestScoreBoardRet.message,
                    data: contestScoreBoardRet.err
                });
            }
            return contestWindow.webContents.send('updatedContestScoreBoard', {
                code: 200,
                desc: "Success.",
                data: contestScoreBoardRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('updatedContestScoreBoard', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

ipcMain.on('updateContestClarification', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/clarification`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('updatedContestClarification', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/clarification`);
        let contestClarificationRet = tryParseJSON(body);
        if(contestClarificationRet === false){
            return contestWindow.webContents.send('updatedContestClarification', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            console.log(contestClarificationRet);
            if(contestClarificationRet.success === false){
                return contestWindow.webContents.send('updatedContestClarification', {
                    code: 4000,
                    desc: contestClarificationRet.message,
                    data: contestClarificationRet.err
                });
            }
            contestClarificationRet.ret.clarifications.forEach(clarification => {
                viewed_ccid[clarification.ccid] = true;
            });
            if(fetchAnnouncementTimeoutStarted === false){
                fetchAnnouncementTimeout(true);
            }
            return contestWindow.webContents.send('updatedContestClarification', {
                code: 200,
                desc: "Success.",
                data: contestClarificationRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('updatedContestClarification', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

ipcMain.on('requestContestClarification', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/requestClarification`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid,
            title: arg.title,
            content: arg.content,
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('requestedContestClarification', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/requestClarification`);
        let contestClarificationRet = tryParseJSON(body);
        if(contestClarificationRet === false){
            return contestWindow.webContents.send('requestedContestClarification', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            if(contestClarificationRet.success === false){
                return contestWindow.webContents.send('requestedContestClarification', {
                    code: 4000,
                    desc: contestClarificationRet.message,
                    data: contestClarificationRet.err
                });
            }
            return contestWindow.webContents.send('requestedContestClarification', {
                code: 200,
                desc: "Success.",
                data: contestClarificationRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('requestedContestClarification', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

ipcMain.on('updateContestChallenge', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/problems`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid,
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('updatedContestChallenge', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/problems`);
        let contestChallengeRet = tryParseJSON(body);
        if(contestChallengeRet === false){
            return contestWindow.webContents.send('updatedContestChallenge', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            console.log(contestChallengeRet);
            if(contestChallengeRet.success === false){
                return contestWindow.webContents.send('updatedContestChallenge', {
                    code: 4000,
                    desc: contestChallengeRet.message,
                    data: contestChallengeRet.err
                });
            }
            return contestWindow.webContents.send('updatedContestChallenge', {
                code: 200,
                desc: "Success.",
                data: contestChallengeRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('updatedContestChallenge', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

ipcMain.on('submitContestChallengeSolution', (event, arg) => {
    console.log(arg);
    request.post({
        url: `${generalDomain}/api/contest/submitSolution`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid,
            pid: arg.pid,
            coid: arg.coid,
            solution: arg.solution,
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            return contestWindow.webContents.send('submittedContestChallengeSolution', {
                code: 2003,
                desc: "Network Error.",
                data: null
            });
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/submitSolution`);
        let contestChallengeSubmitSolutionRet = tryParseJSON(body);
        if(contestChallengeSubmitSolutionRet === false){
            return contestWindow.webContents.send('submittedContestChallengeSolution', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
        try{
            if(contestChallengeSubmitSolutionRet.success === false){
                return contestWindow.webContents.send('submittedContestChallengeSolution', {
                    code: 4000,
                    desc: contestChallengeSubmitSolutionRet.message,
                    data: contestChallengeSubmitSolutionRet.err
                });
            }
            fetchVerdictTimeout(contestChallengeSubmitSolutionRet.ret.sid, true);
            return contestWindow.webContents.send('submittedContestChallengeSolution', {
                code: 200,
                desc: "Success.",
                data: contestChallengeSubmitSolutionRet.ret
            });
        }
        catch (e) {
            return contestWindow.webContents.send('submittedContestChallengeSolution', {
                code: 3100,
                desc: "API Response Error, Please Contact Site Admin.",
                data: null
            });
        }
    });
});

ipcMain.on('showSubmissionDetails', (event, arg) => {
    let sid = arg.sid;
    const {width, height} = screen.getPrimaryDisplay().workAreaSize;
    submissionModel = new BrowserWindow({
        width: parseInt(width*0.7),
        height: parseInt(height*0.7),
        resizable: false,
        defaultFontSize: 16,
        center: true,
        webPreferences: {
            nodeIntegration: true
        },
        show: false,
        parent: contestWindow,
        modal: true,
        useContentSize: true,
        frame: false,
        transparent: true,
        maximizable: false,
        minimizable: false
    }).on('closed', (event) => {
        contestWindow.setAlwaysOnTop(false);
        contestWindow.webContents.send('closeSubmissionDetails', {
            code: 200,
            desc: "OK",
            data: null
        });
    }).on('focus', () => {
        contestWindow.setAlwaysOnTop(true);
    }).on('blur', () => {
        contestWindow.setAlwaysOnTop(false);
    });
    submissionModel.webContents.loadFile(path.join(__dirname, 'submissionDetail.html')).then(()=>{
        request.post({
            url: `${generalDomain}/api/submission/info`,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${userToken}`,
            },
            form: {
                sid: sid
            }
        }, function optionalCallback(err, httpResponse, body) {
            if (err) {
                console.error('REQUEST FAILURE:', err);
                submissionModel.hide();
                return contestWindow.webContents.send('closeSubmissionDetails', {
                    code: 2003,
                    desc: "Network Error.",
                    data: null
                });
            }
            console.log('REQUEST SUCCESS:');
            console.log(`${generalDomain}/api/submission/info`);
            let submissionRet = tryParseJSON(body);
            if(submissionRet === false){
                return contestWindow.webContents.send('closeSubmissionDetails', {
                    code: 3100,
                    desc: "API Response Error, Please Contact Site Admin.",
                    data: null
                });
            }
            if(submissionRet.success === false){
                return contestWindow.webContents.send('closeSubmissionDetails', {
                    code: 4000,
                    desc: submissionRet.message,
                    data: submissionRet.err
                });
            }
            return submissionModel.webContents.send('updatedSubmissionDetail', {
                code: 200,
                desc: "Success.",
                data: submissionRet.ret
            });
        });
        // submissionModel.show();
        // submissionModel.webContents.send('initVisible');
    });
    submissionModel.webContents.once('did-finish-load', () => {
        submissionModel.show();
        submissionModel.webContents.send('initVisible');
        // submissionModel.webContents.openDevTools();
    });
});


ipcMain.on('showSubmissionSaveDialog', (event, arg) => {
    let langConfig = NOJFileType.getFileType(arg.language);
    let filters = [{ name: 'All Files', extensions: ['*'] }];
    let extension = "";
    if(typeof langConfig !== "undefined") {
        let extensions = [];
        langConfig.extensions.forEach(ele => {
            extensions.push(ele.substr(1));
        });
        filters.unshift({ name: `${langConfig.aliases[0]} source file`, extensions: extensions });
        extension = `.${extensions[0]}`;
    }
    let savePath = dialog.showSaveDialogSync(submissionModel, {
        title: "Save Source Code As",
        defaultPath: path.join(app.getPath("downloads"), `${arg.fileName}${extension}`),
        filters: filters,
    });
    if(typeof savePath !== "undefined") {
        try {
            fs.writeFileSync(savePath, arg.code, 'utf-8');
        }
        catch(e) {
            dialog.showMessageBoxSync(submissionModel, {
                type: "error",
                title: "Save Source Code Failed",
                message: "Save Source Code Failed",
                detail: "Failed to save the source code to local."
            });
        }
    }
});

var verdictTimer = {};

function fetchVerdictTimeout(sid, init = false){
    if(init){
        fetchVerdict(sid);
    }else{
        setTimeout(() => {
            fetchVerdict(sid);
        }, 5000);
    }
}

function fetchVerdict(sid){
    request.post({
        url: `${generalDomain}/api/problem/fetchVerdict`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            sid: sid
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            fetchVerdictTimeout(sid);
            return;
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/fetchVerdict`);
        let contestChallengeSubmitSolutionRet = tryParseJSON(body);
        if(contestChallengeSubmitSolutionRet === false){
            fetchVerdictTimeout(sid);
            return;
        }
        try{
            if(contestChallengeSubmitSolutionRet.success === false){
                fetchVerdictTimeout(sid);
                return;
            }
            if(contestChallengeSubmitSolutionRet.ret.submission.color !== "wemd-blue-text") {
                // notify
                if(Notification.isSupported()){
                    new Notification({
                        title: contestChallengeSubmitSolutionRet.ret.submission.verdict,
                        subtitle: contestChallengeSubmitSolutionRet.ret.submission.ncode,
                        body: `Your submission to problem ${contestChallengeSubmitSolutionRet.ret.submission.ncode} has been proceed.`,
                        icon: (contestChallengeSubmitSolutionRet.ret.submission.verdict=="Partially Accepted" || contestChallengeSubmitSolutionRet.ret.submission.verdict=="Accepted") ? path.join(__dirname, 'resources/icons/checked.png') : path.join(__dirname, 'resources/icons/cancel.png'),
                        timeoutType: "default"
                    }).on("click",()=>{
                        mainWindow.focus();
                        mainWindow.webContents.webContents.send('switchTo',{
                            target: "frameStatus",
                            forceUpdate: true,
                            parameters: {
                                account: userInfo.name,
                                problem: contestChallengeSubmitSolutionRet.ret.submission.ncode,
                                result: ""
                            }
                        });
                    }).show();
                }
            } else {
                fetchVerdictTimeout(sid);
            }
            return contestWindow.webContents.send('fetchedVerdict', {
                code: 200,
                desc: "Success.",
                data: contestChallengeSubmitSolutionRet.ret.submission
            });
        }
        catch (e) {
            fetchVerdictTimeout(sid);
            return;
        }
    });
}

var viewed_ccid = {};
var fetchAnnouncementTimeoutStarted = false;

function fetchAnnouncementTimeout(init = false){
    if(init){
        fetchAnnouncementTimeoutStarted = true;
        console.log("Contest Announcement Fetching Started...");
        fetchAnnouncement();
    }else{
        setTimeout(() => {
            fetchAnnouncement();
        }, 30000);
    }
}

function fetchAnnouncement(){
    request.post({
        url: `${generalDomain}/api/contest/fetchAnnouncement`,
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${userToken}`,
        },
        form: {
            cid: cid
        }
    }, function optionalCallback(err, httpResponse, body) {
        if (err) {
            console.error('REQUEST FAILURE:', err);
            fetchAnnouncementTimeout();
            return;
        }
        console.log('REQUEST SUCCESS:');
        console.log(`${generalDomain}/api/contest/fetchAnnouncement`);
        let contestAnnouncementRet = tryParseJSON(body);
        if(contestAnnouncementRet === false){
            fetchAnnouncementTimeout();
            return;
        }
        try{
            if(contestAnnouncementRet.success === false){
                fetchAnnouncementTimeout();
                return;
            }
            contestAnnouncementRet.ret.clarifications.forEach(clarification => {
                if(typeof viewed_ccid[clarification.ccid] === "undefined"){
                    viewed_ccid[clarification.ccid] = true;
                    if(Notification.isSupported()){
                        new Notification({
                            title: clarification.title,
                            subtitle: "Announcement",
                            body: clarification.content,
                            icon: path.join(__dirname, 'resources/icons/announcement.png'),
                            timeoutType: "default"
                        }).on("click",()=>{
                            mainWindow.focus();
                            mainWindow.webContents.webContents.send('switchTo',{
                                target: "frameClarification",
                                forceUpdate: true,
                                parameters: {}
                            });
                        }).show();
                    }
                }
            });
            fetchAnnouncementTimeout();
        }
        catch (e) {
            fetchAnnouncementTimeout();
            return;
        }
    });
}