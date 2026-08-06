import type { WSMessage } from "$lib/common/comms";
import type { Readable } from "svelte/store";
import { source } from "sveltekit-sse";

export type CommsConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export class SSEClient {    
    
    private sse_connection: ReturnType<typeof source> | null = null;
    private closing: boolean = false;
    private sseReconnectAttempts: number = 0;
    private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private sse_data_store: Readable<WSMessage|null> | null = null;
    private sse_store_unsubscribe: (()=>void) | null = null;
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
            if(value) onMessage(value);
        });
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
        this.sseReconnectAttempts = 0;
        this.sse_connection?.close();
        this.sse_store_unsubscribe?.();
    }
}