import { ConnectConfig } from 'ssh2';
export interface IRunResult {
    code: number | null;
    signal?: string;
    stdout?: string;
    stderr?: string;
}
export declare class SSHClient {
    private ready;
    private client;
    private options;
    private logOutput;
    constructor(options: ConnectConfig, logOutput?: boolean);
    close(): void;
    open(): Promise<void>;
    runCommand(command: string, env?: {
        [key: string]: string;
    }, logOutput?: boolean): Promise<IRunResult>;
}
