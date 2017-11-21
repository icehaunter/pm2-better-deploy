import { ConnectConfig } from 'ssh2'
import { SSHClient, IRunResult } from './ssh'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'


export interface IHooks {
    preSetup?: string | string[]
    postSetup?: string | string[]
    preFetch?: string | string[]
    preDeploy?: string | string[]
    deploy?: string | string[]
    postDeploy?: string | string[]
}

export interface IDeployOptions extends ConnectConfig {
    ref: string
    repo: string
    path: string
    hooks?: IHooks
    env?: { [key: string]: string }
}

export class Deployer {
    readonly ref: string
    readonly repo: string
    readonly path: string
    readonly hooks: IHooks
    private client: SSHClient

    private env?: { [key: string]: string }



    constructor(options: IDeployOptions) {
        this.ref = options.ref
        this.repo = options.repo
        this.path = options.path
        this.env = options.env
        this.hooks = options.hooks ? options.hooks : {}

        this.client = new SSHClient(options)
    }

    public start() {
        return this.client.open()
    }

    public stop() {
        return this.client.close()
    }

    private runCommand(command: string | string[], errorMessage?: string) {
        const commandChain = typeof command === 'string' ? command : command.join(' && ')
        return this.client.runCommand(commandChain, this.env).catch((error) => {
            if (error.code)
                throw new Error(errorMessage ? errorMessage: `Command "${commandChain}" failed with code ${error.code}`) 
            throw error
        })
    }

    private async executeHook(commands: string | string[]) {
        try {
            if (typeof commands === 'string') {
                await this.client.runCommand(`cd ${this.path}/current && ${commands}`, this.env, true)
                return 0
            } else {
                for (let command of commands) {
                    await this.client.runCommand(`cd ${this.path}/current && ${command}`, this.env, true)
                }
                return 0
            }
        } catch (error) {
            throw new Error('Hook execution failed')
        }
    }

    public async setup({ force = false }: { force?: boolean } = {}) {
        try {
            if (force)
                await this.runCommand(`rm -rf ${this.path}`, `Could not clean directory`)
            else
                await this.runCommand(`[[ ! -d ${this.path} ]]`, `Folder already exists`)

            if (this.hooks.preSetup) {
                console.log('Running "presetup" hook')
                await this.executeHook(this.hooks.preSetup)
            }

            console.log('Creating directories...')
            await this.runCommand(`mkdir -p ${this.path}/{shared/{logs,pids},source}`, 'Directory structure creation failed')
            console.log('Cloning repo...')
            await this.runCommand(`git clone ${this.repo} ${this.path}/source`, 'Repo cloning failed')
            console.log('Linking source...')
            await this.runCommand(`ln -sfn ${this.path}/source ${this.path}/current`, 'Symlink creation failed')

            if (this.hooks.postSetup) {
                console.log('Running "postsetup" hook')
                await this.executeHook(this.hooks.postSetup)
            }

            return 0
        } catch (error) {
            console.error(error.message)
            return 1
        }
    }

    public async deploy({ newref, newConf }: { newref? : string, newConf?: any } = {}) {
        const ref = newref ? newref : this.ref
        try {
            await this.runCommand
            console.log(`Deploying ${ref}`)

            if (this.hooks.preFetch) {
                console.log('Running "preFetch" hook')
                await this.executeHook(this.hooks.preFetch)
            }
            // await this.runCommand(`cd ${this.path}/source`)
            console.log(`Fetching...`)
            await this.runCommand([`cd ${this.path}/source`, `git fetch --all --tags`], 'Fetch failed')
            console.log(`Resetting HEAD to ${ref}...`)
            await this.runCommand([`cd ${this.path}/source`, `git reset --hard ${ref}`], 'Resetting failed')
            console.log('Linking source...')
            await this.runCommand(`ln -sfn ${this.path}/source ${this.path}/current`, 'Symlink creation failed')

            // Log deployment
            await this.runCommand([
                `cd ${this.path}/source`, `git rev-parse --short HEAD >> ${this.path}/.deploys`
            ], 'Log append failed')

            if (this.hooks.preDeploy) {
                console.log('Running "preDeploy" hook')
                await this.executeHook(this.hooks.preDeploy)
            }

            if (newConf) {
                console.log('Writing new configuration')
                let { stdout: shortcode } = await this.runCommand([`cd ${this.path}/source`, 'git rev-parse --short HEAD'])
                if (shortcode) {
                    shortcode = shortcode.replace(/\s+/, '')
                    await this.runCommand([
                        `echo '${JSON.stringify(newConf).replace(/\"/g, '\\\"')}' > ${this.path}/current/ecosystem.json`
                    ])
                }
            }

            if (this.hooks.deploy) {
                console.log('Running "deploy" hook')
                await this.executeHook(this.hooks.deploy)
            }

            if (this.hooks.postDeploy) {
                console.log('Running "postDeploy" hook')
                await this.executeHook(this.hooks.postDeploy)
            }

            console.log('Deployment successful')
            return 0
        } catch (error) {
            console.error(error.message)
            return 1
        }
    }

    public async run(command: string | string[]) {
        return this.runCommand(command)
    }

    public async test() {
        console.log(this.env)
        await this.runCommand([`cd ${this.path}/current`, '.venv/bin/python ./manage.py migrate'])
    }
}
