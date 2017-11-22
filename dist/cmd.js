#! /usr/bin/env node
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
const deployer_1 = require("./deployer");
const yargs = require("yargs");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const checkFile = (configPath) => {
    const fullPath = path_1.resolve(configPath);
    try {
        fs_1.accessSync(fullPath);
    }
    catch (error) {
        throw Error(`File ${fullPath} not found or inaccessible`);
    }
    try {
        const config = require(fullPath);
        if (config.apps === undefined || config.deploy === undefined)
            throw Error();
        return config;
    }
    catch (err) {
        throw Error(`File ${fullPath} is not a valid config file`);
    }
};
const argv = yargs
    .usage('Usage: $0 <command> [options]')
    .command({
    command: 'setup <env>',
    describe: 'setup deployment environment',
    builder: (args) => {
        return args.option('reset', {
            alias: 'r',
            type: 'boolean',
            describe: 'Reset deployment environment, deleting everything that was there'
        }).check(argv => {
            if (argv.config.deploy[argv.env] !== undefined) {
                return true;
            }
            throw new Error('Environment not found in specified config file');
        });
    },
    handler: (argv) => __awaiter(this, void 0, void 0, function* () {
        const { user, host, ref, repo, path, key } = argv.config.deploy[argv.env];
        const { 'pre-setup': preSetup, 'post-setup': postSetup, 'pre-fetch': preFetch, 'pre-deploy': preDeploy, 'deploy': deploy, 'post-deploy': postDeploy } = argv.config.deploy[argv.env];
        const deployer = new deployer_1.Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            privateKey: key ? fs_1.readFileSync(path_1.resolve(key)) : fs_1.readFileSync(path_1.join(os_1.homedir(), '.ssh', 'id_rsa')),
            hooks: {
                preSetup, postSetup, preFetch, preDeploy, deploy, postDeploy
            }
        });
        try {
            yield deployer.start();
            yield deployer.setup({ force: argv.reset });
        }
        catch (error) {
            console.log(error);
        }
        finally {
            deployer.stop();
        }
    })
})
    .command({
    command: 'run <env> [command...]',
    describe: 'setup deployment environment',
    builder: (args) => {
        return args.check(argv => {
            if (argv.config.deploy[argv.env] !== undefined) {
                return true;
            }
            throw new Error('Environment not found in specified config file');
        });
    },
    handler: (argv) => __awaiter(this, void 0, void 0, function* () {
        const { user, host, ref, repo, path, key } = argv.config.deploy[argv.env];
        const deployer = new deployer_1.Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            privateKey: key ? fs_1.readFileSync(path_1.resolve(key)) : fs_1.readFileSync(path_1.join(os_1.homedir(), '.ssh', 'id_rsa')),
        });
        try {
            yield deployer.start();
            const result = yield deployer.run(argv.command.join(' '));
            console.log(result);
        }
        catch (error) {
            console.log(error);
        }
        finally {
            deployer.stop();
        }
    })
})
    .command({
    command: ['$0 <env> [ref]', 'deploy <env> [ref]'],
    describe: 'Deploy [ref] to <env>',
    builder: (args) => {
        return args.check(argv => {
            if (argv.config.deploy[argv.env] !== undefined) {
                return true;
            }
            throw new Error('Environment not found in specified config file');
        });
    },
    handler: ({ config, env, ref: newref }) => __awaiter(this, void 0, void 0, function* () {
        const { user, host, key, repo, ref, path, env: deployEnv = {}, save_env, use_env } = config.deploy[env];
        const { 'pre-setup': preSetup, 'post-setup': postSetup, 'pre-fetch': preFetch, 'pre-deploy': preDeploy, 'deploy': deploy, 'post-deploy': postDeploy } = config.deploy[env];
        let savedEnv = {};
        if (Array.isArray(save_env)) {
            savedEnv = (save_env).reduce((agg, val) => {
                if (process.env[val] !== undefined) {
                    agg[val] = process.env[val];
                }
            }, {});
        }
        else if (typeof save_env === 'object') {
            for (let key in save_env) {
                if (process.env[save_env[key]] !== undefined) {
                    savedEnv[key] = process.env[save_env[key]];
                }
            }
        }
        const finalEnv = Object.assign({}, deployEnv, savedEnv);
        const deployer = new deployer_1.Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            env: finalEnv,
            privateKey: key ? fs_1.readFileSync(path_1.resolve(key)) : fs_1.readFileSync(path_1.join(os_1.homedir(), '.ssh', 'id_rsa')),
            hooks: {
                preSetup, postSetup, preFetch, preDeploy, deploy, postDeploy
            }
        });
        let newConf;
        if (savedEnv !== {}) {
            newConf = config;
            newConf.apps = newConf.apps.map((app) => {
                let newApp = Object.assign({}, app);
                for (const key in app) {
                    if (key.startsWith('env')) {
                        newApp[key] = Object.assign({}, app[key], savedEnv);
                    }
                }
                return newApp;
            });
        }
        try {
            yield deployer.start();
            yield deployer.deploy({ newref, newConf });
        }
        catch (error) {
            console.log(error);
        }
        finally {
            deployer.stop();
        }
    })
})
    .option('config', {
    alias: 'c',
    describe: 'Set ecosystem config file',
    demandOption: 'Config file must be set',
    nargs: 1,
    global: true,
    coerce: (filename) => {
        return checkFile(filename);
    },
})
    .argv;
