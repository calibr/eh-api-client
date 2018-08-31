// Type definitions for eh-api-client 0.24.0
// Project: https://github.com/calibr/eh-api-client
// Definitions by: Rusinov Maxim <https://github.com/rusmaxim>

declare class Client {
    fork(subUrl): Client;
    request(method): Promise<any>;
    exists(url, options?, cb?): Promise<boolean>;
    get(options, body?, cb?): Promise<any>;
    post(options, body?, cb?): Promise<any>;
    put(options, body?, cb?): Promise<any>;
    head(options, body?, cb?): Promise<any>;
    patch(options, body?, cb?): Promise<any>;
    delete(options, body?, cb?): Promise<any>;
    setSessionId(sessionId: string): void;
    setRequestId(requestId: string): void;
    addRequestModificator(modificator): void;
    prototype: any;
}

declare class APIFactory {
    Client: Client;
    getClientByContext(context: any): Client;
    constructor(apiURL);
    setRetryOptions(options: any);
    setAgentOptions(options: any);
    setSecret(secret: string);
    exists(options?, cb?): Promise<boolean>;
    getClient(userId: number, app: string): Client;
    getRawClient(): Client;
    get(options, body?, cb?): Promise<any>;
    post(options, body?, cb?): Promise<any>;
    put(options, body?, cb?): Promise<any>;
    head(options, body?, cb?): Promise<any>;
    patch(options, body?, cb?): Promise<any>;
    delete(options, body?, cb?): Promise<any>;
}

export = APIFactory
