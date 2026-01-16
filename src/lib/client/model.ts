import type { BellRingRequestMessage, ClockMessage, DayMessage, SyncMessage, WSMessage } from "$lib/common/comms";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { source } from "sveltekit-sse";


type updateClockCallbackType = (params: {cur: number; max: number})=>void;


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

class BellRinger {
    private audioPlayer: HTMLAudioElement;
    private dtm: ServerDeltaTimeManager;

    private timeout: ReturnType<typeof setTimeout>|null = null;
    private params: {
        scheduledRingTimeServer: BOTCTimeType;
        ringBellAtTimeServer?: BOTCTimeType;
    }|null = null;

    constructor(audioPlayer: HTMLAudioElement, dtm: ServerDeltaTimeManager){
        this.audioPlayer = audioPlayer;
        this.dtm = dtm;

        this.audioPlayer.src = '/bell.mp3';
        this.audioPlayer.preload = 'auto';
        this.audioPlayer.load();
        this.audioPlayer.addEventListener('ended', () => {
            if(this.audioPlayer){
                console.log("Bell sound ended, resetting audio player.");
                this.audioPlayer.currentTime = 0;
                this.audioPlayer.load();
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
        this.audioPlayer.play().catch((error) => {
            console.error("Error playing bell sound:", error);
        });
    }
};


export class ClientModel {
    private audioPlayer?: HTMLAudioElement;
    private sse_connection: ReturnType<typeof source> | null = null;
    private sse_data_store: Readable<ClockMessage|null> | null = null;
    private sse_store_unsubscribe: (()=>void) | null = null;


    state: Writable<'counting' | 'idle'> = writable('idle');
    private tickTimeout: ReturnType<typeof setTimeout>|null = null; 
    private setupTimeout: number|null = null;
    private startTime: BOTCTimeType|null = null;
    private duration: number|null = null;
    private ringBellAfter: number|null = null;
    
    deltaTimeManager: ServerDeltaTimeManager = new ServerDeltaTimeManager();
    bellRinger?: BellRinger;

    day_info: Writable<{day: number; max: number}> = writable({day: 0, max: 8});
    clock_info: Writable<{cur: number; max: number}> = writable({cur: 0, max:60});

    constructor(){
        if(this.audioPlayer){
            this.bellRinger = new BellRinger(this.audioPlayer, this.deltaTimeManager);
        }
    }

    init(audioPlayer?: HTMLAudioElement){
        this.sse_connection = source('/events/clock', {
            close({ connect }) {
                console.log('reconnecting...')
                connect()
            },
            open() {
                console.log('connected to clock events')
            },
            error(err) {
                console.error('connection error:', err)
            }
        });
        this.sse_data_store = this.sse_connection.select('message').json<ClockMessage>();
        this.sse_store_unsubscribe = this.sse_data_store.subscribe((value) => {
            if(value) this.handleClockMessage(value);
        });
        if(audioPlayer) {
            this.bellRinger = new BellRinger(audioPlayer, this.deltaTimeManager);
        }
    }
    
    playBellSound() {
        this.bellRinger?.ringBell();
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
                this.bellRinger?.ringBell();
                this.clock_info.set({cur: 0, max: this.duration});
            } else {
                if (this.ringBellAfter !== null) {
                    if (elapsed >= this.ringBellAfter) {
                        this.bellRinger?.ringBell();
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

    handleClockMessage(message: WSMessage) {
        console.log("Received clock message:", message);
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
            default:
                console.warn("Unknown message type received:", message);
        }
    }

    handleDayMessage(message: DayMessage) {
        this.day_info.set({day: message.day, max: message.max});
    }
    

    handleSyncMessage(message: SyncMessage) {
        this.deltaTimeManager.handleSyncMessage(message);
    }

    handleClockStateMessage(message: ClockMessage) {
        this.state.set(message.running ? 'counting' : 'idle');
        this.startTime = {time: message.startTime, reference: 'server'};
        this.duration = message.duration;
        this.ringBellAfter = message.ringBellAfter;
        this.updateClock();
    }

    handleBellRingRequestMessage(message: BellRingRequestMessage){
        if(message.atTime !== undefined){
            let targetTime = this.deltaTimeManager.toLocalTime({time: message.atTime, reference: 'server'}).time;
            let timeToSleep = targetTime - Date.now();
            if(timeToSleep > 0){
                setTimeout(()=>{
                    this.playBellSound();
                }, timeToSleep);
            } else {
                this.playBellSound();
            }
        } else {
            this.playBellSound();
        }
    }

    close(){
        console.log("Closing ClientModel connections");
        if(this.sse_connection)
            this.sse_connection.close();
    }
}