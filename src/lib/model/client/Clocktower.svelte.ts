import { AudioClockTrack } from "$lib/audio/client/AudioClockTrack.svelte";
import type { ClocktowerModel as ClocktowerModel } from "../common/ClocktowerModel";
import type { ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
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

/** Outgoing audio-param edits (gain/pan/balance, from the mixer's clock channel strip) are batched for
 *  this long, so dragging a slider doesn't flood the server. */
const AUDIO_SEND_DELAY_MS = 80;
/** Incoming values for these fields are ignored for this long after editing them locally, so a stale echo
 *  doesn't fight the user's slider mid-drag - same technique as AmbienceEngine/StingEngine use. */
const AUDIO_LOCAL_EDIT_HOLD_MS = 500;
const AUDIO_FIELD_KEYS = ['gain', 'pan', 'balance'] as const;

export class Clocktower extends EventEmitter<ClocktowerEvents> {
    
    get id() { return this.#model.clock.clockId; }

    // Getters / setters
    get gain() { return this.#model.audio.gain; }
    set gain(gain: number){ this.#model.audio.gain = gain; this.scheduleAudioSend(); }

    get pan() { return this.#model.audio.pan; }
    set pan(pan: number) { this.#model.audio.pan = pan; this.scheduleAudioSend(); }

    get balance() { return this.#model.audio.balance; }
    set balance(balance: number) { this.#model.audio.balance = balance; this.scheduleAudioSend(); }

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
    
    // A clock set up with no time (e.g. the day was ended early) is already at night.
    get progress() { return this.#model.clock.time.duration === 0 ? 1 : this.#progress; }

    // Private attrs
    #model: ClocktowerModel;
    #clockStartTime: BOTCTimeType|null = null;
    #audioTrack: AudioClockTrack|null = $state(null);
    #sseConnection: SSEClient;
    #serverDeltaTimeManager: ServerDeltaTimeManager;
    #tickTimeout: ReturnType<typeof setTimeout>|null = null;
    #audioSendTimer: ReturnType<typeof setTimeout>|null = null;
    #audioLocalEdits = new Map<string, number>();


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
        this.timeOfDay = $derived<TimeOfDay>(this.#model.clock.time.duration === 0 || this.progress === 1 ? 'night' : 'day');
        this.#serverDeltaTimeManager = new ServerDeltaTimeManager();
        this.#sseConnection = new SSEClient(`/events/clock/${this.id}`, (msg)=>{
            if(msg.type !== 'sync') console.log(msg);
            switch(msg.type){
                case 'sync':
                    this.#serverDeltaTimeManager.handleSyncMessage(msg);
                    break;
                case 'clock':
                    if(msg.model.clock.clockId === this.id){
                        // Deliberately doesn't touch this.#model.audio: the connected AudioClockTrack (see
                        // connectAudio) is wired directly to that object, and audio params are kept in sync
                        // separately (see 'clockAudioModel' below) - swapping it out here would silently
                        // desync the actual playing track from this.#model.audio on every clock update.
                        this.#model.clock = msg.model.clock;
                        this.#model.config = msg.model.config;
                        this.#clockStartTime = msg.model.clock.time.serverStartTime !== null ? {time: msg.model.clock.time.serverStartTime, reference: 'server'} : null;
                        this.updateClock();
                    }
                    break;
                case 'clockAudioModel':
                    this.applyRemoteAudio(msg.model);
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
        // Syncs the mixer's clock channel strip (gain/pan/balance) to every other connected mixer.
        this.#audioTrack.onLocalChange = ()=>this.scheduleAudioSend();
        return this.#audioTrack;
    }

    disconnectAudio(){
        this.#audioTrack?.close();
        this.#audioTrack = null;
    }

    // ---- Audio params (gain/pan/balance) -> server ----

    private scheduleAudioSend(){
        const now = Date.now();
        for(const k of AUDIO_FIELD_KEYS) this.#audioLocalEdits.set(k, now);
        if(this.#audioSendTimer !== null) return;
        this.#audioSendTimer = setTimeout(()=>{
            this.#audioSendTimer = null;
            this.sendAudioParams();
        }, AUDIO_SEND_DELAY_MS);
    }

    private sendAudioParams(){
        fetch(`/api/clock/${this.id}/audioParams`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(this.#model.audio)
        }).then((res)=>{
            if(!res.ok) console.error(`Clocktower ${this.id} - audio params update rejected: ${res.status}`);
        }).catch((e)=>{
            console.error(`Clocktower ${this.id} - failed to send audio params update`, e);
        });
    }

    // ---- Server -> local audio params ----

    private applyRemoteAudio(model: ClocktowerAudioTrackModel){
        const now = Date.now();
        const audio = this.#model.audio;
        for(const k of AUDIO_FIELD_KEYS){
            const editedAt = this.#audioLocalEdits.get(k);
            if(editedAt !== undefined && now - editedAt < AUDIO_LOCAL_EDIT_HOLD_MS) continue;
            if(audio[k] !== model[k]) audio[k] = model[k];
        }
        if(audio.resources.finalBell !== model.resources.finalBell) audio.resources.finalBell = model.resources.finalBell;
        if(audio.resources.reminderBell !== model.resources.reminderBell) audio.resources.reminderBell = model.resources.reminderBell;
    }

    close(){
        this.disconnectAudio();
        if(this.#audioSendTimer !== null){
            clearTimeout(this.#audioSendTimer);
            this.#audioSendTimer = null;
            this.sendAudioParams(); // Don't lose the last edit
        }
        this.#sseConnection.close();
    }

}