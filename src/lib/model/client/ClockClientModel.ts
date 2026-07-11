import type { AudioParams } from "$lib/common/AudioParams";
import type { AudioParamsMessage, BellRingRequestMessage, ClockMessage, DayMessage, PlayerCountMessage, SyncMessage, WSMessage } from "$lib/common/comms";
import { getDefaultConfig, type Config } from "$lib/common/config";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { source } from "sveltekit-sse";


type updateClockCallbackType = (params: {cur: number; max: number})=>void;

export type CommsConnectionStatus = 'connected' | 'disconnected' | 'connecting';

type BOTCTimeType = {
    time: number;
    reference: 'server' | 'local';
}

function BOTCTimeTypeNow(): BOTCTimeType {
    return { time: Date.now(), reference: 'local' } as BOTCTimeType;
}

class ServerDeltaTimeManager {
    deltaToServerTime: number[] = [];
    avgDeltaToServerTime: number = 0;
    minDeltaToServerTime: number = 0;

    handleSyncMessage(msg: SyncMessage){
        let delta = Date.now() - msg.serverTime;

        this.deltaToServerTime.push(delta);
        if(this.deltaToServerTime.length > 50) {
            this.deltaToServerTime.shift();
        }

        const avgDelta = this.deltaToServerTime.reduce((a, b) => a + b, 0) / this.deltaToServerTime.length;
        // Filter out anything outside of 1 standard deviation
        const mean = avgDelta;
        const stdDev = Math.sqrt(this.deltaToServerTime.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / this.deltaToServerTime.length);
        let filteredTimes = this.deltaToServerTime.filter(x => Math.abs(x - mean) <= stdDev);
        this.avgDeltaToServerTime = filteredTimes.reduce((a, b) => a + b, 0) / filteredTimes.length;
        this.minDeltaToServerTime = Math.min(...filteredTimes);
        // console.log("Clock sync: average delta to server time (ms):", this.avgDeltaToServerTime, " min delta (ms):", this.minDeltaToServerTime);
    }

    toLocalTime(t: BOTCTimeType): BOTCTimeType{
        let time = t.reference === 'server' ? t.time + this.minDeltaToServerTime : t.time;
        return {time: time, reference: 'local'};
    }

    toServerTime(t: BOTCTimeType): BOTCTimeType{
        let time = t.reference === 'local' ? t.time - this.minDeltaToServerTime : t.time;
        return {time: time, reference: 'server'};
    }

    subtract(a: BOTCTimeType, b: BOTCTimeType): number {
        let a_time = a.reference === 'server' ? a.time + this.minDeltaToServerTime : a.time;
        let b_time = b.reference === 'server' ? b.time + this.minDeltaToServerTime : b.time;
        return a_time - b_time;
    }
};

export class BellClientModelBellRinger {
    private audioPlayer: HTMLAudioElement;
    private dtm: ServerDeltaTimeManager;

    private timeout: ReturnType<typeof setTimeout>|null = null;
    private params: {
        scheduledRingTimeServer: BOTCTimeType;
        ringBellAtTimeServer?: BOTCTimeType;
    }|null = null;

    constructor(readonly resource_id: string, audioPlayer: HTMLAudioElement, dtm: ServerDeltaTimeManager){
        this.audioPlayer = audioPlayer;
        this.dtm = dtm;

        this.audioPlayer.src = `/api/resources/${this.resource_id}`;
        this.audioPlayer.preload = 'auto';
        this.audioPlayer.load();
        this.audioPlayer.addEventListener('ended', () => {
            if(this.audioPlayer){
                console.log("Bell sound ended, resetting audio player.");
                this.audioPlayer.currentTime = 0;
            }
        });
    }

    checkTimer(){
        if(!this.params){
            return;
        }
        this.stopTimer();
        let localTargetTime = this.dtm.toLocalTime(this.params.scheduledRingTimeServer);
        let timeToSleep = localTargetTime.time - Date.now();
        if(timeToSleep <= 0){
            this.ringBell();
            this.params = null;
        } else {
            this.timeout = setTimeout(()=>{
                this.checkTimer();
            }, Math.min(timeToSleep, 1000)); // check every second as server/local time may drift
        }  
    }

    startTimer(params: {scheduledRingTimeServer: BOTCTimeType; ringBellAtTimeServer?: BOTCTimeType}){
        this.params = params;
        this.checkTimer();
    }

    stopTimer(){
        if(this.timeout !== null){
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    ringBell(){
        if(this.audioPlayer.currentTime !== 0){
            this.audioPlayer.currentTime = 0;
        }

        // Keep success path separate so we don't log a ring if autoplay policy blocked playback.
        this.audioPlayer.play()
            .then(() => {
                console.log("Ringing bell (url=", this.audioPlayer.src, ")");
            })
            .catch((error) => {
                console.error("Error playing bell sound:", error);
            });
    }
};

type SSEConnectionManagerEventHandlerType = {onMessage?: (msg: WSMessage)=>void};
/**
 * Manages the SSE connection to the server for receiving clock updates, including automatic reconnection with exponential backoff and handling mobile background/foreground transitions. Provides a simple interface for the client model to receive messages and track connection status.
 */
class SSEConnectionManager{
    readonly sourceUrl: string;
    comms_state: Writable<CommsConnectionStatus> = writable('disconnected');
    private eventHandlers: SSEConnectionManagerEventHandlerType;
    private closing: boolean = false;
    private sse_connection: ReturnType<typeof source> | null = null;
    private sse_data_store: Readable<ClockMessage|null> | null = null;
    private sse_store_unsubscribe: (()=>void) | null = null;
    private sseReconnectAttempts: number = 0;
    private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;

    private lifecycleEventsBound: boolean = false;
    
    constructor(sourceUrl: string, eventHandlers: SSEConnectionManagerEventHandlerType = {}){
        this.sourceUrl = sourceUrl;
        this.eventHandlers = eventHandlers;

        const self = this;
        this.sse_connection = source(this.sourceUrl, {
            close({ connect }) {
                if(self.closing){
                    console.log('SSE connection closed by client, not reconnecting.');
                    return;
                }
                console.log('SSE closed; reconnecting...');
                self.comms_state.set('connecting');
                connect();
            },
            open() {
                console.log('SSE connected to clock events');
                self.sseReconnectAttempts = 0;
                if(self.sseReconnectTimer){
                    clearTimeout(self.sseReconnectTimer);
                    self.sseReconnectTimer = null;
                }
                self.comms_state.set('connected');
            },
            error(err) {
                console.error('SSE connection error:', err);
                self.comms_state.set('disconnected');
                // Schedule a reconnect via close() to trigger the built-in connect()
                self.scheduleSSEReconnect();
            }
        });
        this.sse_data_store = this.sse_connection.select('message').json<ClockMessage>();
        this.sse_store_unsubscribe = this.sse_data_store.subscribe((value) => {
            if(value && this.eventHandlers.onMessage) this.eventHandlers.onMessage(value);
        });


        // Bind lifecycle events once to handle mobile background/foreground transitions
        if(!this.lifecycleEventsBound){
            this.bindLifecycleEvents();
            this.lifecycleEventsBound = true;
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
        console.log("Closing SSEConnectionManager connections");
        this.closing = true;
        if(this.sse_connection)
            this.sse_connection.close();
        if(this.sse_store_unsubscribe)
            this.sse_store_unsubscribe();
        if(this.sseReconnectTimer){
            clearTimeout(this.sseReconnectTimer);
            this.sseReconnectTimer = null;
        }
    }

    private bindLifecycleEvents(){
        // When page becomes visible again, force a reconnect to recover from suspended connections
        document.addEventListener('visibilitychange', () => {
            if(document.visibilityState === 'visible'){
                this.sseReconnectAttempts = 0;
                this.sse_connection?.close();
            }
        });

        // Safari/iOS can use BFCache; pageshow with persisted=true indicates restore — refresh SSE
        window.addEventListener('pageshow', (event: PageTransitionEvent) => {
            // Always attempt a reconnect on pageshow to be safe
            this.sseReconnectAttempts = 0;
            this.sse_connection?.close();
        });

        // Recover when network comes back online
        window.addEventListener('online', () => {
            this.sseReconnectAttempts = 0;
            this.sse_connection?.close();
        });
    }
}


export type ClientModelListenerType = {
    onReminderBellRing?: () => void;
    onFinalBellRing?: () => void;
    onBellRingRequest?: () => void;
    onClockReset?: () => void;
    onAudioParamsChanged?: (params: AudioParams) => void;
}

export class ClockClientModel {
    state: Writable<'counting' | 'idle'> = writable('idle');
    private tickTimeout: ReturnType<typeof setTimeout>|null = null; 
    private startTime: BOTCTimeType|null = null;
    private duration: number|null = null;
    private ringBellAfter: number|null = null;
    sse_connection_manager: SSEConnectionManager|null = null;
    
    deltaTimeManager: ServerDeltaTimeManager = new ServerDeltaTimeManager();
    
    finalBellRinger?: BellClientModelBellRinger;
    reminderBellRinger?: BellClientModelBellRinger;

    day_info: Writable<{day: number; max: number}> = writable({day: 0, max: 8});
    clock_info: Writable<{cur: number; max: number}> = writable({cur: 0, max:60});
    audioParams: Writable<AudioParams> = writable({gain: 1, pan: 0});
    playerCount: Writable<number> = writable(0);

    private listeners: Set<ClientModelListenerType> = new Set();

    constructor(public readonly clockId: string = "default", public readonly config: Config = getDefaultConfig(), audioParams: AudioParams|undefined = undefined){
        if(audioParams){
            console.log("Initializing ClockClientModel with audio params:", audioParams);
            this.audioParams.set(audioParams);
        }
    }

    init(){
        console.log("Initializing ClockClientModel connections for clockId:", this.clockId);
        const self = this;
        if(this.sse_connection_manager === null){
            this.sse_connection_manager = new SSEConnectionManager(`/events/clock/${this.clockId}`, {
                onMessage(msg: WSMessage) {
                    self.handleClockMessage(msg);
                }
            });
        }
    }

    private clearTickTimeout() {
        if(this.tickTimeout !== null) {
            clearTimeout(this.tickTimeout);
            this.tickTimeout = null;
        }
    }

    private updateClock() {
        if(this.startTime === null || this.duration === null) return;
        this.clearTickTimeout();
        if(get(this.state) === 'counting') {
            const now = BOTCTimeTypeNow();
            const elapsed = Math.round(this.deltaTimeManager.subtract(now, this.startTime) / 1000);
            const remaining = this.duration - elapsed;
            if(remaining <= 0) {
                this.state.set('idle');
                 // If over 2 seconds late, assume clock was reset and don't ring bell
                if(remaining > -2) {
                    this.finalBellRinger?.ringBell();
                    this.listeners.forEach(listener => listener.onFinalBellRing?.());
                    this.clock_info.set({cur: 0, max: this.duration});
                }
            } else {
                if (this.ringBellAfter !== null) {
                    if (elapsed >= this.ringBellAfter) {
                        this.reminderBellRinger?.ringBell();
                        this.listeners.forEach(listener => listener.onReminderBellRing?.());
                        this.ringBellAfter = null; // prevent multiple rings
                    }
                }
                this.clock_info.set({cur: remaining, max: this.duration});

                // Sleep until the next second (server time) to align the timeout
                const nextSecondLocal = this.deltaTimeManager.toLocalTime({time: this.startTime.time + (elapsed + 1) * 1000, reference: 'server'});
                const delay = nextSecondLocal.time - Date.now();
                this.tickTimeout = setTimeout(() => {
                    this.updateClock();
                }, delay);
            }
        } else {
            this.clock_info.set({cur: this.duration || 60, max: this.duration || 60});
        }
    }

    private handleClockMessage(message: WSMessage) {
        if(message.type !== 'sync') console.debug("Received clock message:", message);
        switch(message.type) {
            case 'clock':
                this.handleClockStateMessage(message as ClockMessage);
                break;
            case 'sync':
                this.handleSyncMessage(message as SyncMessage);
                break;
            case 'day':
                this.handleDayMessage(message as DayMessage);
                break;
            case 'bellRingRequest':
                this.handleBellRingRequestMessage(message as BellRingRequestMessage)
                break;
            case 'audioParams':
                this.handleAudioParamsChanged(message as AudioParamsMessage);
                break;
            case 'playerCount':
                this.handlePlayerCountMessage(message as PlayerCountMessage);
                break;
            default:
                console.warn("Unknown message type received:", message);
        }
    }

    private handlePlayerCountMessage(message: PlayerCountMessage){
        this.playerCount.set(message.playerCount);
    }

    private handleDayMessage(message: DayMessage) {
        this.day_info.set({day: message.day, max: message.max});
    }
    

    private handleSyncMessage(message: SyncMessage) {
        this.deltaTimeManager.handleSyncMessage(message);
    }

    private handleClockStateMessage(message: ClockMessage) {
        this.state.set(message.running ? 'counting' : 'idle');
        this.startTime = {time: message.startTime, reference: 'server'};
        this.duration = message.duration;
        this.ringBellAfter = message.ringBellAfter;
        this.updateClock();
    }

    private handleBellRingRequestMessage(message: BellRingRequestMessage){
        if(message.atTime !== undefined){
            let targetTime = this.deltaTimeManager.toLocalTime({time: message.atTime, reference: 'server'}).time;
            let timeToSleep = targetTime - Date.now();
            if(timeToSleep > 0){
                setTimeout(()=>{
                    this.finalBellRinger?.ringBell();
                    this.listeners.forEach(listener => listener.onBellRingRequest?.());
                }, timeToSleep);
            } else {
                this.finalBellRinger?.ringBell();
                this.listeners.forEach(listener => listener.onBellRingRequest?.());
            }
        } else {
            this.finalBellRinger?.ringBell();
            this.listeners.forEach(listener => listener.onBellRingRequest?.());
        }
    }

    private handleAudioParamsChanged(message: AudioParamsMessage){
        this.setAudioParams({gain: message.gain, pan: message.pan}, false);
    }

    close(){
        console.log("Closing ClientModel connections");
        this.sse_connection_manager?.close();
        this.clearTickTimeout();
    }

    addListener(listener: ClientModelListenerType) {
        if(!this.listeners.has(listener)){
            console.debug("Adding listener to clock", {
                id: this.clockId,
                listener
            });
            this.listeners.add(listener);
        }
        return ()=>{
            this.listeners.delete(listener);
        }
    }

    removeListener(listener: ClientModelListenerType) {
        if(this.listeners.has(listener))
           this.listeners.delete(listener);
    }

    ringFinalBell(broadcast: boolean = false){
        if(broadcast){
            fetch(`/api/clock/${this.clockId}/ringBell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({atTime: Date.now()})
            }).catch(err=>{
                console.error("Error sending ringBell request to server:", err);
            });
            return;
        } else {
            this.finalBellRinger?.ringBell();
            this.listeners.forEach(listener => listener.onFinalBellRing?.());
        }
    }

    setAudioParams(params: AudioParams, broadcast: boolean = false){
        this.audioParams.set(params);
        this.listeners.forEach(listener => listener.onAudioParamsChanged?.(params));
        if(broadcast){
            fetch(`/api/clock/${this.clockId}/audioParams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params)
            }).catch(err=>{
                console.error("Error sending audioParams update to server:", err);
            });
        }
    }

    finalBellURL(){
        const resourceId = this.config.resourceMapping.finalBell.resource_id;
        return resourceId ? `/api/resources/${resourceId}` : null;
    }

    reminderBellURL(){
        const resourceId = this.config.resourceMapping.reminderBell.resource_id;
        return resourceId ? `/api/resources/${resourceId}` : null;
    }
}