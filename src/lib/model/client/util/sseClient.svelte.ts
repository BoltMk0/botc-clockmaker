import type { WSMessage } from "$lib/common/comms";
import type { Readable } from "svelte/store";
import { source } from "sveltekit-sse";

export type CommsConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// The server broadcasts a `sync` message every 500ms while a connection is alive (see
// +server.ts). If we haven't heard anything for much longer than that, the underlying
// connection is almost certainly a zombie (e.g. the mobile OS silently dropped the socket
// while the device was asleep) even though the browser hasn't fired an `error`/`close` event.
const WATCHDOG_MESSAGE_TIMEOUT_MS = 5000;
const WATCHDOG_CHECK_INTERVAL_MS = 2000;

export class SSEClient {

    private sse_connection: ReturnType<typeof source> | null = null;
    private closing: boolean = false;
    private sseReconnectAttempts: number = 0;
    private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private sse_data_store: Readable<WSMessage|null> | null = null;
    private sse_store_unsubscribe: (()=>void) | null = null;
    #ping_unsubscribe: (()=>void) | null = null;
    private lastMessageTime: number = Date.now();
    private watchdogInterval: ReturnType<typeof setInterval> | null = null;
    private wakeListenersAttached = false;
    private readonly handleWake = () => {
        if(document.visibilityState !== 'visible') return;
        console.log('SSE: detected page wake/visibility change, forcing reconnect.');
        this.forceReconnect();
    };
    comms_state = $state<CommsConnectionStatus>('disconnected');

    constructor(
        readonly sourceUrl: string,
        onMessage: (msg: WSMessage)=>void
    ){

        const self = this;
        this.sse_connection = source(this.sourceUrl, {
            close({ connect }) {
                if(self.closing){
                    console.log('SSE connection closed by client, not reconnecting.');
                    return;
                }
                console.log('SSE closed; reconnecting...');
                self.comms_state = 'connecting';
                connect();
            },
            open() {
                console.log('SSE connected to clock events');
                self.sseReconnectAttempts = 0;
                self.lastMessageTime = Date.now();
                if(self.sseReconnectTimer){
                    clearTimeout(self.sseReconnectTimer);
                    self.sseReconnectTimer = null;
                }
                self.comms_state = 'connected';
            },
            error(err) {
                console.error('SSE connection error:', err);
                self.comms_state = 'disconnected';
                // Schedule a reconnect via close() to trigger the built-in connect()
                self.scheduleSSEReconnect();
            }
        });
        this.sse_data_store = this.sse_connection.select('message').json<WSMessage>();
        this.sse_store_unsubscribe = this.sse_data_store.subscribe((value) => {
            if(value){
                this.lastMessageTime = Date.now();
                onMessage(value);
            }
        });
        // The server also sends a periodic `ping` (a plain keep-alive, not a WSMessage - see the
        // `ping` option on the various `produce()` routes) on every SSE route, whereas an actual
        // `sync`/app WSMessage only flows on the clock route (its 500ms tick) or when something
        // genuinely changes elsewhere (ambience/sting/spotify/audioDim). Without also counting pings
        // as a liveness signal, the watchdog below would wrongly declare those quieter connections
        // stale and force-reconnect them every few seconds even while perfectly healthy.
        this.#ping_unsubscribe = this.sse_connection.select('ping').subscribe(() => {
            this.lastMessageTime = Date.now();
        });

        if(typeof window !== 'undefined'){
            this.watchdogInterval = setInterval(() => this.checkWatchdog(), WATCHDOG_CHECK_INTERVAL_MS);
            document.addEventListener('visibilitychange', this.handleWake);
            window.addEventListener('pageshow', this.handleWake);
            window.addEventListener('online', this.handleWake);
            this.wakeListenersAttached = true;
        }
    }

    private checkWatchdog(){
        if(this.closing) return;
        // Only the "connected" state can go silently stale; 'connecting'/'disconnected'
        // are already being retried by scheduleSSEReconnect.
        if(this.comms_state !== 'connected') return;
        if(Date.now() - this.lastMessageTime > WATCHDOG_MESSAGE_TIMEOUT_MS){
            console.warn('SSE: no messages received recently, assuming connection is stale. Forcing reconnect...');
            this.forceReconnect();
        }
    }

    private forceReconnect(){
        if(this.closing) return;
        this.comms_state = 'connecting';
        this.sseReconnectAttempts = 0;
        if(this.sseReconnectTimer){
            clearTimeout(this.sseReconnectTimer);
            this.sseReconnectTimer = null;
        }
        try {
            // Triggers the close({connect}) handler above, which immediately reconnects.
            this.sse_connection?.close();
        } catch (e) {
            console.error('Error during SSE close for forced reconnect:', e);
        }
    }

    private scheduleSSEReconnect(){
        if(this.sseReconnectTimer){
            return; // already scheduled
        }
        const delay = Math.min(1000 * Math.pow(2, this.sseReconnectAttempts), 15000);
        this.sseReconnectAttempts++;
        this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = null;
            // Trigger close to invoke the provided close({connect}) handler
            try {
                this.sse_connection?.close();
            } catch (e) {
                console.error('Error during SSE close for reconnect:', e);
            }
        }, delay);
    }

    close(){
        this.closing = true;
        this.sseReconnectAttempts = 0;
        if(this.sseReconnectTimer){
            clearTimeout(this.sseReconnectTimer);
            this.sseReconnectTimer = null;
        }
        if(this.watchdogInterval){
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
        }
        if(this.wakeListenersAttached){
            document.removeEventListener('visibilitychange', this.handleWake);
            window.removeEventListener('pageshow', this.handleWake);
            window.removeEventListener('online', this.handleWake);
            this.wakeListenersAttached = false;
        }
        this.sse_connection?.close();
        this.sse_store_unsubscribe?.();
        this.#ping_unsubscribe?.();
    }
}