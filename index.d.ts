// Type definitions for eh-api-client 0.24.0
// Project: https://github.com/calibr/eh-api-client
// Definitions by: Rusinov Maxim <https://github.com/rusmaxim>

interface OptionsObj extends  Record<string, unknown> {
    url?: string | [string, ...unknown[]];
}
export type Options = OptionsObj | string | [string, ...unknown[]]

export type Callback<T extends any> = (err: unknown, data: T, res: unknown, req: unknown) => void

export declare class Client {
    fork(subUrl: string): Client;
    request<T extends any>(method: string, options: Options, cb?: Callback<T> ): Promise<T>;
    request<T extends any>(method: string, options: Options, body: unknown, cb?: Callback<T> ): Promise<T>;
    exists(url: string, cb?: Callback<boolean>): Promise<boolean>;
    exists(url: string, options: Options, cb?: Callback<boolean>): Promise<boolean>;
    get<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    post<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    post<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    put<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    put<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    head<T extends any>(options: Options, cb?: Callback<unknown>): Promise<unknown>;
    patch<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    patch<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    delete<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    setSessionId(sessionId: string): void;
    setRequestId(requestId: string): void;
    setDeviceId(deviceId: string): void;
    addRequestModificator(modificator: (params: Record<string, unknown>) => Record<string, unknown>): void;
    setHeaders(headers: Record<string, string>): void;
    prototype: Client;
}


export interface RetryOptions {
    maxAttempts?: number;
    retryDelay?: number;
    retryStrategy?: (err: unknown, params: Record<string, unknown>) => boolean;
}

export declare class APIFactory {
    Client: { new ():Client };
    secret: string | null

    constructor(apiURL: string);

    getClientByContext(context: unknown): Client;
    setRetryOptions(options: RetryOptions): void;
    setAgentOptions(options: Record<string, unknown>): void;
    setSecret(secret: string): void;

    exists(cb?: Callback<boolean>): Promise<boolean>;
    exists(options: Options, cb?: Callback<boolean>): Promise<boolean>;
    getClient(userId: number, app: string): Client;
    getRawClient(): Client;
    get<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    post<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    post<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    put<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    put<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    head<T extends any>(options: Options, cb?: Callback<unknown>): Promise<unknown>;
    patch<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;
    patch<T extends any>(options: Options, body: unknown, cb?: Callback<T>): Promise<T>;
    delete<T extends any>(options: Options, cb?: Callback<T>): Promise<T>;

    static on(event: string, cb: (...args: unknown[]) => unknown): void

    static setAsyncLocalStorage(asyncLocalStorage): void
    static getFromStore(property: string): string
    static setClientProperties(client: Client, contenxt: unknown): void
}

export default APIFactory

type A<a extends b, b = string> = {a: a}
