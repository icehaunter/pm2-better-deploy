#! /usr/bin/env node
import { Deployer, IDeployOptions } from "./deployer";
import * as yargs from 'yargs';
import { statSync, accessSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";

const checkFile = (configPath: string) => {
    const fullPath = resolve(configPath)
    try {
        accessSync(fullPath)
    } catch (error) {
        throw Error(`File ${fullPath} not found or inaccessible`)
    }
    try {
        const config = require(fullPath)
        if (config.apps === undefined || config.deploy === undefined) throw Error()
        return config

    } catch (err) {
        throw Error(`File ${fullPath} is not a valid config file`)
    }
}

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
            if ( argv.config.deploy[argv.env] !== undefined) {
                return true
            }
            throw new Error('Environment not found in specified config file')
        })
    },
    handler: async (argv) => {
        const { user, host, ref, repo, path, key } = argv.config.deploy[argv.env]
        const { 
            'pre-setup': preSetup, 
            'post-setup': postSetup,
            'pre-fetch': preFetch,
            'pre-deploy': preDeploy,
            'deploy': deploy,
            'post-deploy': postDeploy 
        } = argv.config.deploy[argv.env]

        const keyPath = key ? resolve(key) : join(homedir(), '.ssh', 'id_rsa')
        const privateKey = readFileSync(keyPath)
        const deployer = new Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            privateKey,
            hooks: {
                preSetup, postSetup, preFetch, preDeploy, deploy, postDeploy
            }
        })
        try {
            await deployer.start()
            await deployer.setup({ force: argv.reset })
        } catch (error) {
            console.log(error)
            process.exit(1)
        } finally {
            deployer.stop()
        }
    }
})
.command({
    command: 'run <env> [command...]', 
    describe: 'setup deployment environment', 
    builder: (args) => {
        return args.check(argv => {
            if ( argv.config.deploy[argv.env] !== undefined) {
                return true
            }
            throw new Error('Environment not found in specified config file')
        })
    },
    handler: async (argv) => {
        const { user, host, ref, repo, path, key } = argv.config.deploy[argv.env]

        const deployer = new Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            privateKey: key ? readFileSync(resolve(key)) : readFileSync(join(homedir(), '.ssh', 'id_rsa')),
        })
        try {
            await deployer.start()
            const result = await deployer.run(argv.command.join(' '))
            console.log(result)
        } catch (error) {
            console.log(error)
            process.exit(1)
        } finally {
            deployer.stop()
        }
    }
})
.command({
    command: ['$0 <env> [ref]', 'deploy <env> [ref]'],
    describe: 'Deploy [ref] to <env>',
    builder: (args) => {
        return args.check(argv => {
            if ( argv.config.deploy[argv.env] !== undefined) {
                return true
            }
            throw new Error('Environment not found in specified config file')
        })
    },
    handler: async ({ config, env, ref: newref }: { config: any, env: string, ref?: string}) => {
        const { 
            user, host, key,
            repo, ref, path,
            env: deployEnv = {}, save_env, use_env } = config.deploy[env]
        const { 
            'pre-setup': preSetup, 
            'post-setup': postSetup,
            'pre-fetch': preFetch,
            'pre-deploy': preDeploy,
            'deploy': deploy,
            'post-deploy': postDeploy 
        } = config.deploy[env]

        let savedEnv: { [key: string]: string } = {}
        if (Array.isArray(save_env)) {
            savedEnv = (save_env).reduce((agg: {[key: string]: string}, val: string) => {
                if (process.env[val] !== undefined) {
                    agg[val] = process.env[val] as string
                }
            }, {})
        } else if (typeof save_env === 'object') {
            for (let key in save_env as { [key: string]: string }) {
                if (process.env[save_env[key]] !== undefined) {
                    savedEnv[key] = process.env[save_env[key]] as string
                }
            }
        }
        const finalEnv = {
            ...deployEnv as { [key: string]: string },
            ...savedEnv
        }

        const keyPath = key ? resolve(key) : join(homedir(), '.ssh', 'id_rsa')
        const privateKey = readFileSync(keyPath)

        const deployer = new Deployer({
            username: user,
            host,
            ref,
            repo,
            path,
            env: finalEnv,
            privateKey,
            hooks: {
                preSetup, postSetup, preFetch, preDeploy, deploy, postDeploy
            }
        })

        let newConf
        if (savedEnv !== {}) {
            newConf = config
            newConf.apps = newConf.apps.map((app: { [key: string]: any }) => {
                let newApp = { ...app }
                for (const key in app) {
                    if (key.startsWith('env')) {
                        newApp[key] = {
                            ...app[key],
                            ...savedEnv
                        }
                    }
                }
                return newApp
            })
        }


        try {
            await deployer.start()
            await deployer.deploy({ newref, newConf })
        } catch (error) {
            console.log(error)
            process.exit(1)
        } finally {
            deployer.stop()
        }
    }
})
.option('config', {
    alias: 'c',
    describe: 'Set ecosystem config file',
    demandOption: 'Config file must be set',
    nargs: 1,
    global: true,
    coerce: (filename) => {
        return checkFile(filename)
    },
})
.argv
