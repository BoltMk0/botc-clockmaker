import type { BellRingRequestMessage, ClockMessage, DayMessage, SyncMessage, WSMessage } from "$lib/common/comms";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { source } from "sveltekit-sse";


type updateClockCallbackType = (params: {cur: number; max: number})=>void;

export class ClientModel {
    private audioPlayer?: HTMLAudioElement;
    private sse_connection: ReturnType<typeof source> | null = null;
    private sse_data_store: Readable<ClockMessage|null> | null = null;
    private sse_store_unsubscribe: (()=>void) | null = null;


    state: Writable<'counting' | 'idle'> = writable('idle');
    private interval: number|null = null; 
    private setupTimeout: number|null = null;
    private startTime: number|null = null;
    private duration: number|null = null;
    private ringBellAfter: number|null = null;
    deltaToServerTime: number[] = [];
    avgDeltaToServerTime: number = 0;
    minDeltaToServerTime: number|null = null;

    day_info: Writable<{day: number; max: number}> = writable({day: 0, max: 8});
    clock_info: Writable<{cur: number; max: number}> = writable({cur: 0, max:60});

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

        this.audioPlayer = audioPlayer;
        if(this.audioPlayer){
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
    }

    // on(event: 'updateClock', listener: (params: {cur: number; max: number}) => void): this;
    // on(event: string, listener: (...args: any[]) => void): this {
    //     return super.on(event, listener);
    // }
    
    playBellSound() {
        // reset player to start
        if(!this.audioPlayer) return;
        if(this.audioPlayer.currentTime !== 0){
            this.audioPlayer.currentTime = 0;
        }
        this.audioPlayer.play().catch((error) => {
            console.error("Error playing bell sound:", error);
        });
    }

    private updateClock() {
        if(this.startTime === null || this.duration === null) return;
        if(get(this.state) === 'counting') {
            const now = Date.now();
            const adjNow = this.localTimeToServerTime(now);
            const elapsed = Math.round((adjNow - this.startTime) / 1000);
            if(this.ringBellAfter !== null && elapsed >= this.ringBellAfter) {
                this.playBellSound();
                this.ringBellAfter = null; // prevent multiple rings
            }

            const remaining = this.duration - elapsed;
            if(remaining <= 0) {
                this.state.set('idle');
                if(this.interval !== null) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
                // this.onUpdateClock({cur: 0, max: this.duration});
                this.clock_info.set({cur: 0, max: this.duration});
                this.playBellSound();
            } else {
                // this.onUpdateClock({cur: remaining, max: this.duration});
                this.clock_info.set({cur: remaining, max: this.duration});
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
        // Implement sync handling if needed
        let delta = Date.now() - message.serverTime;

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

    handleClockStateMessage(message: ClockMessage) {
        this.state.set(message.running ? 'counting' : 'idle');
        this.startTime = message.startTime;
        this.duration = message.duration;
        this.ringBellAfter = message.ringBellAfter;
        
        if(this.setupTimeout !== null) {
            clearTimeout(this.setupTimeout);
            this.setupTimeout = null;
        }

        if(this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        if(get(this.state) === 'counting') {
            // Wait until the next second to align the interval
            const now = this.localTimeToServerTime(Date.now());
            const delay = 1000 - (now % 1000);
            
            this.setupTimeout = window.setTimeout(() => {
                this.interval = window.setInterval(() => {
                    this.updateClock();
                }, 1000);
                this.updateClock(); // Initial update
            }, delay);
        }

        this.updateClock();
    }

    serverTimeToLocalTime(t: number){
        return t + (this.minDeltaToServerTime ?? 0);
    }

    localTimeToServerTime(t: number){
        return t - (this.minDeltaToServerTime ?? 0);
    }

    handleBellRingRequestMessage(message: BellRingRequestMessage){
        if(message.atTime !== undefined){
            let targetTime = this.serverTimeToLocalTime(message.atTime);
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