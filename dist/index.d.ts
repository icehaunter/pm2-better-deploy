import { ConnectConfig } from 'ssh2';
export interface IHooks {
    preSetup?: string | string[];
    postSetup?: string | string[];
    preFetch?: string | string[];
    preDeploy?: string | string[];
    deploy?: string | string[];
    postDeploy?: string | string[];
}
export interface IDeployOptions extends ConnectConfig {
    ref: string;
    repo: string;
    path: string;
    hooks?: IHooks;
    env?: {
        [key: string]: string;
    };
}
export declare class Deployer {
    readonly ref: string;
    readonly repo: string;
    readonly path: string;
    readonly hooks: IHooks;
    private client;
    private env?;
    constructor(options: IDeployOptions);
    start(): Promise<void>;
    stop(): void;
    private runCommand(command, errorMessage?);
    private executeHook(commands);
    setup({force}?: {
        force?: boolean;
    }): Promise<0 | 1>;
    deploy({newref}?: {
        newref?: string;
    }): Promise<0 | 1>;
    test(): Promise<void>;
}
