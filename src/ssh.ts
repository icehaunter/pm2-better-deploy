import { Client, ConnectConfig } from 'ssh2'
import { resolve } from 'url';

export interface IRunResult {
    code: number | null
    signal?: string
    stdout?: string
    stderr?: string
}

export class SSHClient {
    private ready: boolean = false
    private client: Client 
    private options: ConnectConfig
    private logOutput: boolean

    constructor(options: ConnectConfig, logOutput: boolean = false) {
        this.client = new Client()
        this.options = options
        this.logOutput = logOutput
    }

    public close() {
        this.client.end()
    }

    public open() {
        return new Promise<void>((resolve, reject) => {
            this.client.on('ready', () => {
                resolve()
            }).on('error', (err) => {
                console.log(err)
                reject(err)
            }).connect(this.options)
        })
    }

    public runCommand(command: string, env?: { [key: string]: string }, logOutput: boolean = false) {
        const log = this.logOutput && logOutput
        return new Promise<IRunResult>((resolve, reject) => {
            let processedEnv = []
            let commandWithEnv = command
            if (env) {
                for (let item in env) {
                    processedEnv.push(`${item}="${env[item]}"`)
                }

                commandWithEnv = processedEnv.join(' ') + ` bash -c "${commandWithEnv}"`
            }
            this.client.exec(commandWithEnv, { env }, (err, stream) => {
                console.log(`executing ${commandWithEnv}`)
                if (err) {
                    reject(err)
                    return
                }
                if (typeof stream === "undefined") {
                    reject(new Error('Connection is not open'))
                    return
                }


                let stdout: string | undefined
                let stderr: string | undefined

                stream.on('close', (code: number | null, signal: string | undefined) => {
                    const result = {
                        code,
                        signal,
                        stdout,
                        stderr
                    }
                    if (code === 0) {
                        resolve(result)
                        return
                    }
                    else {
                        reject(result)
                        return
                    }
                })
                stream.on('data', (data: string | Buffer) => {
                    if (typeof data === 'string')
                        stdout = data
                    else
                        stdout = data.toString('utf-8')
                    log || console.log('stdout: ' + data)
                }).stderr.on('data', (data) => {
                    if (typeof data === 'string')
                        stderr = data
                    else
                        stderr = data.toString('utf-8')
                    log || console.log('stderr: ' + data)
                })
            })
        })
    }

    
}