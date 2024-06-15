const { app, BrowserWindow, nativeImage, shell, dialog } = require('electron');
const remoteGitTags = require('remote-git-tags');
const path = require('path');
const electron = require('electron');

const ScratchArduinoLink = require('./server');

const fs = require('fs');
const compareVersions = require('compare-versions');
const del = require('del');

const Menu = electron.Menu;
const Tray = electron.Tray;
var appTray = null;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, './icon/scratch-arduino-link.ico'),
        width: 400,
        height: 400,
        center: true,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true
        }
    })

    mainWindow.loadFile('./src/index.html');
    mainWindow.setMenu(null)
    
    const userDataPath = electron.app.getPath('userData');
    const dataPath = path.join(userDataPath, 'Data');
    const appPath = app.getAppPath();
    const appVersion = app.getVersion();
    // console.log('userDataPath: ', userDataPath);
    // console.log('Current version: ', appVersion);

    // if current version is newer then cache log, delet the data cache dir and write the new version into the cache file.
    const applicationConfig = path.join(userDataPath, 'application.json');
    if (fs.existsSync(applicationConfig)) {
        const oldVersion = JSON.parse(fs.readFileSync(applicationConfig)).version;
        if (compareVersions.compare(appVersion, oldVersion, '>')) {
            if (fs.existsSync(dataPath)) {
                del.sync([dataPath], {force: true});
            }
            fs.writeFileSync(applicationConfig, JSON.stringify({version: appVersion}));
        }
    } else {
        if (fs.existsSync(dataPath)) {
            del.sync([dataPath], {force: true});
        }
        fs.writeFileSync(applicationConfig, JSON.stringify({version: appVersion}));
    }

    let toolsPath;
    if (appPath.search(/app.asar/g) === -1) {
        toolsPath = path.join(appPath, "tools");
    } else {
        toolsPath = path.join(appPath, "../tools");
    }
    const link = new ScratchArduinoLink(dataPath, toolsPath);
    link.start().then(
        link.listen()
    );

    const trayMenuTemplate = [
        {
            label: 'Lanuch',
            click: function () {
                shell.openExternal('https://scratch.ottawastem.com/')
            }
        },
        {type: 'separator'},
        {
            label: 'Help',
            click: function () {
                shell.openExternal('https://ottawastem.com/support/')
            }
        },
        {
            label: 'Exit',
            click: function () {
                appTray.destroy();
                mainWindow.destroy();
                app.exit();
            }
        }
    ];
 
    if (process.platform === 'win32') {
        appTray = new Tray(nativeImage.createFromPath(path.join(__dirname, './icon/scratch-arduino-link.ico')));
    } else if (process.platform === 'darwin') {
        appTray = new Tray(nativeImage.createFromPath(path.join(__dirname, './icon/scratch-arduino-link-menubar.png')));
    }
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    appTray.setToolTip('Scratch Arudino Link');
    appTray.setContextMenu(contextMenu);
    
    appTray.on('click',function(){
        mainWindow.show();
    })

    mainWindow.on('close', (event) => { 
        mainWindow.hide(); 
        event.preventDefault();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    })
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) 
                mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    })
    app.on('ready', createWindow);
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
})

app.whenReady().then(() => {
    (async () => {
        let dialogOptions = {
            title: 'Scratch Arduino Link',
            type: 'info',
            buttons: ['Download', 'Later'],
            defaultId: 0,
            message: 'New release available.',
            detail: '',
            noLink: true,
            icon: path.join(__dirname, './icon/scratch-arduino-link.ico')
        }
        if (process.platform === 'darwin') {
            dialogOptions.icon = path.join(__dirname, './icon/scratch-arduino-link.icns')
        }
        const tags = await remoteGitTags('https://github.com/OttawaSTEM/scratch-arduino-link')
        const latestVersion = Array.from(tags.keys()).pop().substring(1);
        if (latestVersion > app.getVersion()) {
            dialogOptions.detail = 'Installed version: v' + app.getVersion() + '\n';  
            dialogOptions.detail = dialogOptions.detail + 'Latest version: v' + latestVersion;  
            dialog.showMessageBox(null, dialogOptions).then((data) => {
                if (data.response == 0) {
                    shell.openExternal('https://github.com/OttawaSTEM/scratch-arduino-link/releases/latest');
                }
            });
        }
    })();
})