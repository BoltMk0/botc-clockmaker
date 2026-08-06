import type { ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
import type { ClockInstanceInfo, Config } from "$lib/common/config";
import type { TimerOption } from "$lib/common/timerOption";
import { setClockConfigResource } from "$lib/resources/server/clock-config";
import type { TimeOfDay } from "../client/types";
import { EventEmitter } from "../client/util/eventEmitter";
import type { ClocktowerModel } from "../common/ClocktowerModel";


export class BOTCTClock extends EventEmitter {
    #DEBOUNCE_TIME = 10 as const;

    #model: ClocktowerModel;

    private configSaveTimeout: NodeJS.Timeout | null = null;

    #emissionTimeouts: Map<string|symbol, ReturnType<typeof setTimeout>> = new Map();

    constructor(model: ClocktowerModel){
        super();
        this.#model = model;
        this.#model.audio.resources.finalBell = model.config.resourceMapping.finalBell.resource_id;
        this.#model.audio.resources.reminderBell = model.config.resourceMapping.reminderBell.resource_id;
    }

    on(event: 'audio', listener: (audio: ClocktowerAudioTrackModel) => void): this;
    on(event: 'bellRingRequest', listener: () => void): this;
    on(event: 'modelUpdated', listener: (model: ClocktowerModel) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        console.log("on", event, listener);
        return super.on(event, listener);
    }

    debouncedEmit(eventName: string, ...args: any[]) {
        let timeout = this.#emissionTimeouts.get(eventName);
        if(timeout) clearTimeout(timeout);
        timeout = setTimeout(()=>{
            this.emit(eventName, ...args);
            this.#emissionTimeouts.delete(eventName);
        }, this.#DEBOUNCE_TIME);

        this.#emissionTimeouts.set(eventName, timeout);
    }

    get id() { return this.#model.clock.clockId; }

    get timeOfDay(): TimeOfDay {
        if(this.#model.clock.time.serverStartTime === null) return 'day';
        let elapsedTime = Date.now() - this.#model.clock.time.serverStartTime;
        if(elapsedTime > this.#model.clock.time.duration) return 'night';
        return 'day';
    }

    get running(){
        return this.#model.clock.time.serverStartTime !== null;
    }

    private scheduleSave(){
        if(this.configSaveTimeout){
            clearTimeout(this.configSaveTimeout);
        }
        this.configSaveTimeout = setTimeout(()=>{
            setClockConfigResource(this.id, Buffer.from(JSON.stringify(this.#model)), 'application/json');
            console.log("Config auto-saved for instance", this.id);
            this.configSaveTimeout = null;
        }, 5000); // save config 5 seconds after last change
    }


    get model(){ return this.#model }

    setup(timerOption: TimerOption) {
        console.log("Setting up clock...", timerOption);
        if(this.#model.clock.day === 0 || this.timeOfDay === 'night'){
            // Day had ended, so advance to next day
            console.log("Advancing to next day...");
            this.day += 1;
        } else {
            console.log("No active timer, not advancing day.");
        }
        this.running = false;
        this.duration = timerOption.duration;
        this.ringBellWhen = timerOption.ringBellWhenRemaining ?? undefined;
    }

    start() {
        if (this.running) return;
        this.#model.clock.time.serverStartTime = Date.now();
        this.emit('modelUpdated', this.#model);
    }

    stop() {
        if(!this.running) return;
        this.#model.clock.time.serverStartTime = null;
        this.emit('modelUpdated', this.#model);
    }

    makeDaBellNoise(){
        this.emit('bellRingRequest');
    }


    get day(){ return this.#model.clock.day; }
    get duration() { return this.#model.clock.time.duration; }
    get ringBellWhen() { return this.#model.clock.time.ringBellWhen; }
    get playerCount() { return this.#model.clock.numPlayers; }
    get audioGain() { return this.#model.audio.gain; }
    get audioPan() { return this.#model.audio.pan; }
    get audioBalance() { return this.#model.audio.balance; }
    get finalBellResourceId() { return this.#model.audio.resources.finalBell; }
    get reminderBellResourceId() { return this.#model.audio.resources.reminderBell; }

    get config() { return this.#model.config; }

    set playerCount(playerCount: number){
        this.#model.clock.numPlayers = playerCount;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set audioGain(gain: number){
        this.#model.audio.gain = gain;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }

    set audioPan(pan: number){
        this.#model.audio.pan = pan;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }
    
    set audioBalance(balance: number){
        this.#model.audio.balance = balance;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }

    set finalBellResourceId(id: string|null){
        if(id === '') id = null;
        this.#model.audio.resources.finalBell = id;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }

    
    set reminderBellResourceId(id: string|null){
        if(id === '') id = null;
        this.#model.audio.resources.reminderBell = id;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }

    set day(day: number){
        this.#model.clock.day = day;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set config(config: Config){
        this.#model.config = config;
        this.#model.audio.resources.finalBell = config.resourceMapping.finalBell.resource_id;
        this.#model.audio.resources.reminderBell = config.resourceMapping.reminderBell.resource_id;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set duration(duration: number){
        this.#model.clock.time.duration = duration;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set ringBellWhen(duration: number|undefined){
        this.#model.clock.time.ringBellWhen = duration;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set running(running: boolean){
        running ? this.start() : this.stop();
    }


    save(){
        this.scheduleSave();
    }

    get info(): ClockInstanceInfo{
        return {
            id: this.id,
            config: this.#model.config
        }
    }
};
