"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ssh_1 = require("./ssh");
class Deployer {
    constructor(options) {
        this.ref = options.ref;
        this.repo = options.repo;
        this.path = options.path;
        this.env = options.env;
        this.hooks = options.hooks ? options.hooks : {};
        this.client = new ssh_1.SSHClient(options);
    }
    start() {
        return this.client.open();
    }
    stop() {
        return this.client.close();
    }
    runCommand(command, errorMessage) {
        const commandChain = typeof command === 'string' ? command : command.join(' && ');
        return this.client.runCommand(commandChain, this.env).catch((error) => {
            if (error.code)
                throw new Error(errorMessage ? errorMessage : `Command "${commandChain}" failed with code ${error.code}`);
            throw error;
        });
    }
    executeHook(commands) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (typeof commands === 'string') {
                    yield this.client.runCommand(`cd ${this.path}/current && ${commands}`, this.env, true);
                    return 0;
                }
                else {
                    for (let command of commands) {
                        yield this.client.runCommand(`cd ${this.path}/current && ${command}`, this.env, true);
                    }
                    return 0;
                }
            }
            catch (error) {
                throw new Error('Hook execution failed');
            }
        });
    }
    setup({ force = true } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (force)
                    yield this.runCommand(`rm -rf ${this.path}`, `Could not clean directory`);
                else
                    yield this.runCommand(`[[ ! -d ${this.path} ]]`, `Folder already exists`);
                if (this.hooks.preSetup) {
                    console.log('Running "presetup" hook');
                    yield this.executeHook(this.hooks.preSetup);
                }
                console.log('Creating directories...');
                yield this.runCommand(`mkdir -p ${this.path}/{shared/{logs,pids},source}`, 'Directory structure creation failed');
                console.log('Cloning repo...');
                yield this.runCommand(`git clone ${this.repo} ${this.path}/source`, 'Repo cloning failed');
                console.log('Linking source...');
                yield this.runCommand(`ln -sfn ${this.path}/source ${this.path}/current`, 'Symlink creation failed');
                if (this.hooks.postSetup) {
                    console.log('Running "postsetup" hook');
                    yield this.executeHook(this.hooks.postSetup);
                }
                return 0;
            }
            catch (error) {
                console.error(error.message);
                return 1;
            }
        });
    }
    deploy({ newref } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const ref = newref ? newref : this.ref;
            try {
                yield this.runCommand;
                console.log(`Deploying ${ref}`);
                if (this.hooks.preFetch) {
                    console.log('Running "preFetch" hook');
                    yield this.executeHook(this.hooks.preFetch);
                }
                // await this.runCommand(`cd ${this.path}/source`)
                console.log(`Fetching...`);
                yield this.runCommand([`cd ${this.path}/source`, `git fetch --all --tags`], 'Fetch failed');
                console.log(`Resetting HEAD to ${ref}...`);
                yield this.runCommand([`cd ${this.path}/source`, `git reset --hard ${ref}`], 'Resetting failed');
                console.log('Linking source...');
                yield this.runCommand(`ln -sfn ${this.path}/source ${this.path}/current`, 'Symlink creation failed');
                // Log deployment
                yield this.runCommand([
                    `cd ${this.path}/source`, `echo \`git rev-parse --short HEAD\` >> ${this.path}/.deploys`
                ], 'Log append failed');
                if (this.hooks.preDeploy) {
                    console.log('Running "preDeploy" hook');
                    yield this.executeHook(this.hooks.preDeploy);
                }
                if (this.hooks.deploy) {
                    console.log('Running "deploy" hook');
                    yield this.executeHook(this.hooks.deploy);
                }
                if (this.hooks.postDeploy) {
                    console.log('Running "postDeploy" hook');
                    yield this.executeHook(this.hooks.postDeploy);
                }
                console.log('Deployment successful');
                return 0;
            }
            catch (error) {
                console.error(error.message);
                return 1;
            }
        });
    }
    test() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(this.env);
            yield this.runCommand([`cd ${this.path}/current`, '.venv/bin/python ./manage.py migrate']);
        });
    }
}
exports.Deployer = Deployer;
