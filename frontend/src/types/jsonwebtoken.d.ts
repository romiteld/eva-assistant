declare module 'jsonwebtoken' {
  export interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    issuer?: string;
    jwtid?: string;
    subject?: string;
    noTimestamp?: boolean;
    header?: object;
    keyid?: string;
    mutatePayload?: boolean;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | string[];
    clockTimestamp?: number;
    clockTolerance?: number;
    complete?: boolean;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    nonce?: string;
    subject?: string;
    maxAge?: string | number;
  }

  export interface DecodeOptions {
    complete?: boolean;
    json?: boolean;
  }

  export interface JwtPayload {
    [key: string]: any;
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    callback: (err: Error | null, token?: string) => void
  ): void;

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    options: SignOptions,
    callback: (err: Error | null, token?: string) => void
  ): void;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): JwtPayload | string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    callback: (err: Error | null, decoded?: JwtPayload | string) => void
  ): void;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options: VerifyOptions,
    callback: (err: Error | null, decoded?: JwtPayload | string) => void
  ): void;

  export function decode(
    token: string,
    options?: DecodeOptions
  ): null | { [key: string]: any } | string;

  export class JsonWebTokenError extends Error {
    inner: Error;
    constructor(message: string, error?: Error);
  }

  export class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;
    constructor(message: string, expiredAt: Date);
  }

  export class NotBeforeError extends JsonWebTokenError {
    date: Date;
    constructor(message: string, date: Date);
  }
}