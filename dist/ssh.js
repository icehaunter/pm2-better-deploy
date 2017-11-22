"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ssh2_1 = require("ssh2");
class SSHClient {
    constructor(options, logOutput = false) {
        this.ready = false;
        this.client = new ssh2_1.Client();
        this.options = options;
        this.logOutput = logOutput;
    }
    close() {
        this.client.end();
    }
    open() {
        return new Promise((resolve, reject) => {
            this.client.on('ready', () => {
                resolve();
            }).on('error', (err) => {
                console.log(err);
                reject(err);
            }).connect(this.options);
        });
    }
    runCommand(command, env, logOutput = false) {
        const log = this.logOutput && logOutput;
        return new Promise((resolve, reject) => {
            let processedEnv = [];
            let commandWithEnv = command;
            if (env) {
                for (let item in env) {
                    processedEnv.push(`${item}="${env[item]}"`);
                }
                commandWithEnv = processedEnv.join(' ') + ` bash -c "${commandWithEnv}"`;
            }
            this.client.exec(commandWithEnv, { env }, (err, stream) => {
                console.log(`executing ${commandWithEnv}`);
                if (err) {
                    reject(err);
                    return;
                }
                if (typeof stream === "undefined") {
                    reject(new Error('Connection is not open'));
                    return;
                }
                let stdout;
                let stderr;
                stream.on('close', (code, signal) => {
                    const result = {
                        code,
                        signal,
                        stdout,
                        stderr
                    };
                    if (code === 0) {
                        resolve(result);
                        return;
                    }
                    else {
                        reject(result);
                        return;
                    }
                });
                stream.on('data', (data) => {
                    if (typeof data === 'string') {
                        stdout = data;
                        log || console.log('stdout: ' + data);
                    }
                    else {
                        stdout = data.toString('utf-8');
                        log || console.log('stdout: ' + data.toString('utf-8'));
                    }
                }).stderr.on('data', (data) => {
                    if (typeof data === 'string') {
                        stderr = data;
                        log || console.log('stderr: ' + data);
                    }
                    else {
                        stderr = data.toString('utf-8');
                        log || console.log('stderr: ' + data.toString('utf-8'));
                    }
                });
            });
        });
    }
}
exports.SSHClient = SSHClient;
