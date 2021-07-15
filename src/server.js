const downloadRelease = require('download-github-release');
const http = require('http');
const url = require('url');
const {Server} = require('ws');
const Emitter = require('events');
const fs = require('fs');
const path = require('path');

const user = 'OttawaSTEM';
const leaveZipped = false;
const filterRelease = release => release.prerelease === false;
const filterAsset = () => true;

/**
 * Configuration the default tools path.
 * @readonly
 */
const DEFAULT_TOOLS_PATH = path.join(__dirname, '../tools');

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20111;

/**
 * Configuration the server routers.
 * @readonly
 */
const ROUTERS = {
    '/status': require('./session/link'),
    '/scratch/serialport': require('./session/serialport') // eslint-disable-line global-require
};

/**
 * A server to provide local hardware api.
 */
class ScratchArduinoLink extends Emitter{
    /**
     * Construct a Scratch Arduino link server object.
     * @param {string} userDataPath - the path to save user data.
     * @param {string} toolsPath - the path of build and flash tools.
     */
    constructor (userDataPath, toolsPath) {
        super();

        if (userDataPath) {
            this.userDataPath = path.join(userDataPath, 'link');
        }

        if (toolsPath) {
            this.toolsPath = toolsPath;
        } else {
            this.toolsPath = DEFAULT_TOOLS_PATH;
        }

        this._socketPort = DEFAULT_PORT;
        this._httpServer = new http.Server();
        this._socketServer = new Server({server: this._httpServer});

        this._socketServer.on('connection', (socket, request) => {
            const {pathname} = url.parse(request.url);
            const Session = ROUTERS[pathname];
            let session;
            if (Session) {
                session = new Session(socket, this.userDataPath, this.toolsPath);
                console.log('new connection');
                this.emit('new-connection');
            } else {
                return socket.close();
            }
            const dispose = () => {
                if (session) {
                    session.dispose();
                    session = null;
                }
            };
            socket.on('close', dispose);
            socket.on('error', dispose);
        })
            .on('error', e => {
                const info = `Error while trying to listen port ${this._socketPort}: ${e}`;
                console.warn(info);
            });
    }
    
    /**
     * Check tools, libraries and firmware update.
     */
    async checkUpdate () {
        console.log('Check update');
        // scratch-arduino-tools
        const repo = 'scratch-arduino-tools';
        const outputdir = path.resolve('./firmwares');

        if (!fs.existsSync(outputdir)) {
            fs.mkdirSync(outputdir, {recursive: true});
        }
        
        downloadRelease(user, repo, outputdir, filterRelease, filterAsset, leaveZipped)
            .then(() => {
                console.log('Firmwares download complete.');
            })
            .catch(err => {
                console.error(err.message);
            });
        
    }

    /**
     * Start a server listening for connections.
     * @param {number} port - the port to listen.
     */
    listen (port) {
        if (port) {
            this._socketPort = port;
        }

        this._httpServer.listen(this._socketPort, '127.0.0.1', () => {
            this.emit('ready');
            console.log('socket server listend: ', `http://127.0.0.1:${this._socketPort}`);
        });
    }
}

module.exports = ScratchArduinoLink;
