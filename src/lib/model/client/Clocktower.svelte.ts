import { AudioClockTrack } from "$lib/audio/client/AudioClockTrack.svelte";
import type { ClocktowerModel as ClocktowerModel } from "../common/ClocktowerModel";
import { SSEClient } from "./util/sseClient.svelte";
import type { TimeOfDay } from "./types";
import { BOTCTimeTypeNow, type BOTCTimeType } from "./util/botcTime";
import { ServerDeltaTimeManager } from "./util/serverDeltaTimeManager.svelte";
import { EventEmitter } from "./util/eventEmitter";
import type { AudioTrack } from "$lib/audio/client/AudioTrack.svelte";

type ClocktowerEvents = {
    bellRing: [];
    reminderRing: [];
};

export class Clocktower extends EventEmitter<ClocktowerEvents> {
    
    get id() { return this.#model.clock.clockId; }

    // Getters / setters
    get gain() { return this.#model.audio.gain; }
    set gain(gain: number){ this.#model.audio.gain = gain; } // TOOD: send update to server 

    get pan() { return this.#model.audio.pan; }
    set pan(pan: number) { this.#model.audio.pan = pan; } // TODO: send update to server

    get balance() { return this.#model.audio.balance; }
    set balance(balance: number) { this.#model.audio.balance = balance; }
    
    get finalBellResourceId() { return this.#model.audio.resources.finalBell; }
    get reminderBellResourceId() { return this.#model.audio.resources.reminderBell; }

    get duration(){ return this.#model.clock.time.duration; }

    get hue(): number { return this.#model.config.theme.hue; }
    get day(): number { return this.#model.clock.day; }
    get playerCount(): number { return this.#model.clock.numPlayers; }
    get name(): string { return this.#model.config.teamName ?? this.id; }

    // Helpers
    readonly running: boolean;
    #progress: number = $state(0);  // In range 0-1
    readonly secondsRemaining: number;      // Derived from progress
    readonly timeOfDay: TimeOfDay;
    
    get progress() { return this.#progress; }

    // Private attrs
    #model: ClocktowerModel;
    #clockStartTime: BOTCTimeType|null = null;
    #audioTrack: AudioClockTrack|null = $state(null);
    #sseConnection: SSEClient;
    #serverDeltaTimeManager: ServerDeltaTimeManager;
    #tickTimeout: ReturnType<typeof setTimeout>|null = null;


    get audioTrack(){ return this.#audioTrack; }

    get model(){ return this.#model; }

    constructor(
        model: ClocktowerModel
    ) {
        console.debug("Setting up new Clocktower", model);
        super();
        this.#model = $state(model);
        this.running = $derived(this.#model.clock.time.serverStartTime !== null); 
        this.secondsRemaining = $derived(Math.max(0, this.#model.clock.time.duration - this.progress * this.#model.clock.time.duration));
        this.timeOfDay = $derived<TimeOfDay>(this.progress === 1 ? 'night' : 'day');
        this.#serverDeltaTimeManager = new ServerDeltaTimeManager();
        this.#sseConnection = new SSEClient(`/events/clock/${this.id}`, (msg)=>{
            if(msg.type !== 'sync') console.log(msg);
            switch(msg.type){
                case 'sync':
                    this.#serverDeltaTimeManager.handleSyncMessage(msg);
                    break;
                case 'clock':
                    if(msg.model.clock.clockId === this.id){
                        this.#model = msg.model;
                        this.#clockStartTime = msg.model.clock.time.serverStartTime !== null ? {time: msg.model.clock.time.serverStartTime, reference: 'server'} : null;
                        this.updateClock();
                    }
                    break;
                case 'bellRingRequest':
                    const bellRingFn = msg.bell === 'final' ? ()=>{
                        this.#audioTrack?.ringFinalBell();
                        this.emit('bellRing');
                    } : ()=>{
                        this.#audioTrack?.ringReminderBell();
                        this.emit('reminderRing');
                    }

                    if(msg.atTime){
                        this.#serverDeltaTimeManager.when({ reference: 'server', time: msg.atTime }, ()=>{
                            bellRingFn?.()
                    });
                    } else {
                        bellRingFn?.()
                    }
                    break;
            }
        });
    }

    private clearTickTimeout() {
        if(this.#tickTimeout !== null) {
            clearTimeout(this.#tickTimeout);
            this.#tickTimeout = null;
        }
    }
    
    private updateClock() {
        console.log("update clock", this.#clockStartTime, this.duration);
        if(this.#clockStartTime === null){
            this.#progress = 0;
            return;
        }
        this.clearTickTimeout();
        if(this.running) {
            const now = BOTCTimeTypeNow();
            const elapsed = Math.round(this.#serverDeltaTimeManager.subtract(now, this.#clockStartTime) / 1000);
            this.#progress = Math.min(1, elapsed / this.duration);
            const remaining = this.duration - elapsed;
            if(remaining <= 0) {
                // If over 2 seconds late, assume clock was reset and don't ring bell
                if(remaining > -2) {
                    this.#audioTrack?.ringFinalBell();
                    this.emit('bellRing');
                }
            } else {
                if (this.#model.clock.time.ringBellWhen !== undefined) {
                    if (Math.abs(remaining - this.#model.clock.time.ringBellWhen) < 0.5) {
                        this.#audioTrack?.ringReminderBell();
                        this.emit('reminderRing');
                    }
                }

                // Sleep until the next second (server time) to align the timeout
                const nextSecondLocal = this.#serverDeltaTimeManager.toLocalTime({time: this.#clockStartTime.time + (elapsed + 1) * 1000, reference: this.#clockStartTime.reference});
                const delay = nextSecondLocal.time - Date.now();
                this.#tickTimeout = setTimeout(() => {
                    this.updateClock();
                }, delay);
            }
        }
    }

    connectAudio(outputNode: AudioNode): AudioClockTrack{
        this.disconnectAudio();
        this.#model.audio.resources.finalBell = this.#model.config.resourceMapping.finalBell.resource_id;
        this.#model.audio.resources.reminderBell = this.#model.config.resourceMapping.reminderBell.resource_id;
        this.#audioTrack = new AudioClockTrack(this.#model.clock.clockId, this.#model.audio, this.#model.config.teamName ?? "", outputNode);
        return this.#audioTrack;
    }

    disconnectAudio(){
        this.#audioTrack?.close();
        this.#audioTrack = null;
    }

    close(){
        this.disconnectAudio();
        this.#sseConnection.close();
    }

}