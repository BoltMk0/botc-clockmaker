import { EventEmitter } from "node:events";
import { createParser } from "eventsource-parser";
import type { ClocktowerClockModel } from "../../src/lib/model/common/ClocktowerClockModel.ts";
import type { Config } from "./config.ts";

/** The messages from a clock's event stream Lightscapes uses (see Clockmaker's $lib/common/comms.ts). */
type ClockEvent =
    | { type: 'clock'; model: { clock: ClocktowerClockModel } }
    | { type: 'sync'; serverTime: number }
    | { type: 'bellRingRequest'; bell: 'start' | 'final' };

export type ClockConnection = 'unconfigured' | 'connecting' | 'connected' | 'error';

/** The server broadcasts a sync every 500ms, so a stream quiet for this long has gone dead without closing. */
const WATCHDOG_MS = 5000;
const MAX_BACKOFF_MS = 30_000;
/** How many of the latest syncs the server clock's offset is estimated from. */
const SYNC_SAMPLES = 20;

export class ClockmakerError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
}

/** Calls Clockmaker's API with the API token. */
export async function clockmakerRequest(url: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url + path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        signal: init.signal ?? AbortSignal.timeout(10_000)
    });
    if(!response.ok){
        const message = response.status === 401 ? 'The API token was refused'
            : response.status === 404 ? 'Not found (has the game been deleted?)'
            : `${response.status} ${response.statusText}`;
        throw new ClockmakerError(response.status, message);
    }
    return response;
}

export interface ClockFollower {
    /** The clock's latest state, whenever it changes (and on every reconnect). */
    on(event: 'clock', listener: (clock: ClocktowerClockModel) => void): this;
    on(event: 'bell', listener: (bell: 'start' | 'final') => void): this;
    on(event: 'connection', listener: (connection: ClockConnection) => void): this;
}

/** Follows one clock's event stream, reconnecting whenever it drops. */
export class ClockFollower extends EventEmitter {
    connection: ClockConnection = 'unconfigured';
    error: string | null = null;
    clock: ClocktowerClockModel | null = null;

    #config: Config['clockmaker'] | null = null;
    #abort: AbortController | null = null;
    /** Server time minus local time, from the newest syncs. */
    #offsets: number[] = [];

    /** (Re)connects with a new configuration, if it changed. */
    configure(config: Config['clockmaker']) {
        if(JSON.stringify(config) === JSON.stringify(this.#config)) return;
        this.#config = { ...config };
        this.#abort?.abort();
        this.#abort = null;
        this.clock = null;
        if(!config.url || !config.token || !config.clockId){
            this.#setConnection('unconfigured', null);
            return;
        }
        const abort = new AbortController();
        this.#abort = abort;
        this.#run(config, abort.signal);
    }

    stop() {
        this.#abort?.abort();
        this.#abort = null;
    }

    /** The server's clock now, as near as can be told. */
    serverNow(): number {
        // Each sample is late by however long it took to arrive, so the largest is the closest
        const offset = this.#offsets.length ? Math.max(...this.#offsets) : 0;
        return Date.now() + offset;
    }

    /** Sends a command to the clock. */
    async command(path: string, body?: unknown): Promise<void> {
        const config = this.#config;
        if(!config?.url || !config.token) throw new Error('Clockmaker is not set up');
        await clockmakerRequest(config.url, config.token, path.replace('{clock}', encodeURIComponent(config.clockId)), {
            method: 'POST',
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    #setConnection(connection: ClockConnection, error: string | null) {
        const changed = connection !== this.connection || error !== this.error;
        this.connection = connection;
        this.error = error;
        if(changed) this.emit('connection', connection);
    }

    async #run(config: Config['clockmaker'], signal: AbortSignal) {
        let backoff = 1000;
        while(!signal.aborted){
            this.#setConnection('connecting', this.error);
            try {
                await this.#follow(config, signal, () => backoff = 1000);
                if(!signal.aborted) this.#setConnection('error', 'The connection closed');
            } catch(err) {
                if(signal.aborted) return;
                const message = err instanceof Error ? (err.name === 'TimeoutError' ? 'Timed out' : err.message) : String(err);
                this.#setConnection('error', message);
                console.warn(`Clockmaker: ${message}; retrying in ${backoff / 1000}s`);
            }
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
    }

    async #follow(config: Config['clockmaker'], signal: AbortSignal, onConnected: () => void) {
        // Stopped by the watchdog or the follower's own abort, whichever comes first
        const local = new AbortController();
        const stopLocal = () => local.abort();
        signal.addEventListener('abort', stopLocal);
        let lastMessage = Date.now();
        const watchdog = setInterval(() => {
            if(Date.now() - lastMessage > WATCHDOG_MS) local.abort(new Error('Clockmaker stopped sending updates'));
        }, 1000);

        try {
            const response = await clockmakerRequest(config.url, config.token, `/events/clock/${encodeURIComponent(config.clockId)}`, {
                method: 'POST',
                headers: { Accept: 'text/event-stream' },
                signal: local.signal
            });
            if(!response.body) throw new Error('No event stream');
            this.#offsets = [];
            this.#setConnection('connected', null);
            onConnected();
            console.log(`Clockmaker: following clock ${config.clockId}`);

            const parser = createParser({
                onEvent: (event) => {
                    lastMessage = Date.now();
                    if(event.event !== 'message') return;
                    try {
                        this.#handle(JSON.parse(event.data) as ClockEvent);
                    } catch(err) {
                        console.error('Clockmaker: bad message', err);
                    }
                }
            });
            const decoder = new TextDecoder();
            for await (const chunk of response.body){
                lastMessage = Date.now();
                parser.feed(decoder.decode(chunk, { stream: true }));
            }
        } catch(err) {
            // Report why the watchdog stopped it, rather than just that it was aborted
            if(local.signal.aborted && !signal.aborted && local.signal.reason instanceof Error) throw local.signal.reason;
            throw err;
        } finally {
            clearInterval(watchdog);
            signal.removeEventListener('abort', stopLocal);
        }
    }

    #handle(event: ClockEvent) {
        switch(event.type){
            case 'sync':
                this.#offsets.push(event.serverTime - Date.now());
                if(this.#offsets.length > SYNC_SAMPLES) this.#offsets.shift();
                break;
            case 'clock':
                this.clock = event.model.clock;
                this.emit('clock', event.model.clock);
                break;
            case 'bellRingRequest':
                this.emit('bell', event.bell);
                break;
        }
    }
}
