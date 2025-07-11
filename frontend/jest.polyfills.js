/**
 * @note The block below contains polyfills for Node.js globals
 * required for Jest to function when running JSDOM tests.
 * These must be require()'d (not imported) for proper loading order.
 */

const { TextDecoder, TextEncoder } = require('node:util')
const { ReadableStream, TransformStream } = require('node:stream/web')
const { MessageChannel, MessagePort, BroadcastChannel } = require('node:worker_threads')

Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder },
  TextEncoder: { value: TextEncoder },
  ReadableStream: { value: ReadableStream },
  TransformStream: { value: TransformStream },
  MessageChannel: { value: MessageChannel },
  MessagePort: { value: MessagePort },
  BroadcastChannel: { value: BroadcastChannel },
})

const { Blob, File } = require('node:buffer')
const { fetch, Headers, FormData, Request, Response } = require('undici')

Object.defineProperties(globalThis, {
  Blob: { value: Blob, writable: true, configurable: true },
  File: { value: File, writable: true, configurable: true },
  Headers: { value: Headers, writable: true, configurable: true },
  FormData: { value: FormData, writable: true, configurable: true },
  Request: { value: Request, writable: true, configurable: true },
  Response: { value: Response, writable: true, configurable: true },
  fetch: { value: fetch, writable: true, configurable: true },
})

// Polyfill for structuredClone (Node 17+)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj))
  }
}