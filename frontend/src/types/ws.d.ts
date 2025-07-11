/// <reference types="node" />

import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';

declare module 'ws' {
  export interface ClientOptions {
    handshakeTimeout?: number;
    perMessageDeflate?: boolean | PerMessageDeflateOptions;
    maxPayload?: number;
    skipUTF8Validation?: boolean;
    headers?: { [key: string]: string };
    protocol?: string | string[];
    followRedirects?: boolean;
    origin?: string;
    agent?: any;
    timeout?: number;
  }

  export interface PerMessageDeflateOptions {
    serverNoContextTakeover?: boolean;
    clientNoContextTakeover?: boolean;
    serverMaxWindowBits?: number;
    clientMaxWindowBits?: number;
    threshold?: number;
    level?: number;
    memLevel?: number;
    concurrencyLimit?: number;
  }

  export interface ServerOptions {
    host?: string;
    port?: number;
    backlog?: number;
    server?: any;
    verifyClient?: VerifyClientCallbackAsync | VerifyClientCallbackSync;
    handleProtocols?: (protocols: string[], request: IncomingMessage) => string | false;
    path?: string;
    noServer?: boolean;
    clientTracking?: boolean;
    perMessageDeflate?: boolean | PerMessageDeflateOptions;
    maxPayload?: number;
    skipUTF8Validation?: boolean;
    WebSocket?: typeof WebSocket;
  }

  export type VerifyClientCallbackAsync = (
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (res: boolean, code?: number, message?: string, headers?: { [key: string]: string }) => void
  ) => void;

  export type VerifyClientCallbackSync = (
    info: { origin: string; secure: boolean; req: IncomingMessage }
  ) => boolean;

  export class WebSocket extends EventEmitter {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    readonly readyState: number;
    readonly protocol: string;
    readonly url: string;
    readonly bufferedAmount: number;
    readonly extensions: string;
    readonly binaryType: 'nodebuffer' | 'arraybuffer' | 'fragments';

    // Custom properties
    isAlive?: boolean;
    userId?: string;

    constructor(address: string | URL, options?: ClientOptions);
    constructor(address: string | URL, protocols?: string | string[], options?: ClientOptions);

    close(code?: number, reason?: string): void;
    ping(data?: any, mask?: boolean, callback?: (error?: Error) => void): void;
    pong(data?: any, mask?: boolean, callback?: (error?: Error) => void): void;
    send(data: any, callback?: (error?: Error) => void): void;
    send(data: any, options: { compress?: boolean; binary?: boolean; mask?: boolean; fin?: boolean }, callback?: (error?: Error) => void): void;
    terminate(): void;

    // Events
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'upgrade', listener: (request: IncomingMessage) => void): this;
    on(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: 'ping', listener: (data: Buffer) => void): this;
    on(event: 'pong', listener: (data: Buffer) => void): this;
    on(event: 'unexpected-response', listener: (request: IncomingMessage, response: IncomingMessage) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    once(event: 'error', listener: (error: Error) => void): this;
    once(event: 'upgrade', listener: (request: IncomingMessage) => void): this;
    once(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this;
    once(event: 'open', listener: () => void): this;
    once(event: 'ping', listener: (data: Buffer) => void): this;
    once(event: 'pong', listener: (data: Buffer) => void): this;
    once(event: 'unexpected-response', listener: (request: IncomingMessage, response: IncomingMessage) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;

    removeListener(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    removeListener(event: 'error', listener: (error: Error) => void): this;
    removeListener(event: 'upgrade', listener: (request: IncomingMessage) => void): this;
    removeListener(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this;
    removeListener(event: 'open', listener: () => void): this;
    removeListener(event: 'ping', listener: (data: Buffer) => void): this;
    removeListener(event: 'pong', listener: (data: Buffer) => void): this;
    removeListener(event: 'unexpected-response', listener: (request: IncomingMessage, response: IncomingMessage) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export class WebSocketServer extends EventEmitter {
    readonly clients: Set<WebSocket>;
    readonly options: ServerOptions;
    readonly path: string;

    constructor(options?: ServerOptions, callback?: () => void);

    close(callback?: (err?: Error) => void): void;
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (client: WebSocket, request: IncomingMessage) => void
    ): void;
    shouldHandle(request: IncomingMessage): boolean;

    // Events
    on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'headers', listener: (headers: string[], request: IncomingMessage) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'listening', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    once(event: 'error', listener: (error: Error) => void): this;
    once(event: 'headers', listener: (headers: string[], request: IncomingMessage) => void): this;
    once(event: 'close', listener: () => void): this;
    once(event: 'listening', listener: () => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;

    removeListener(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    removeListener(event: 'error', listener: (error: Error) => void): this;
    removeListener(event: 'headers', listener: (headers: string[], request: IncomingMessage) => void): this;
    removeListener(event: 'close', listener: () => void): this;
    removeListener(event: 'listening', listener: () => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export const WebSocket: typeof WebSocket;
  export const WebSocketServer: typeof WebSocketServer;
}

