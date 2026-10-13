import type { ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
import type { ClockInstanceInfo, Config } from "$lib/common/config";
import type { TimerOption } from "$lib/common/timerOption";
import { clockSfxPlaybackFor } from "$lib/audio/common/clockSfxPreset";
import { CLOCK_CONFIG_MANAGER } from "$lib/resources/server/clock-config";
import { getClockSfxPreset } from "$lib/resources/server/clock-sfx-presets";
import { isDaytime, type TimeOfDay } from "../client/types";
import { EventEmitter } from "../client/util/eventEmitter";
import type { ClocktowerModel } from "../common/ClocktowerModel";


export class BOTCTClock extends EventEmitter {
    #DEBOUNCE_TIME = 10 as const;

    #model: ClocktowerModel;

    private configSaveTimeout: NodeJS.Timeout | null = null;

    /** Set once the game is deleted, so nothing still holding it can save it back. */
    #closed = false;

    #emissionTimeouts: Map<string|symbol, ReturnType<typeof setTimeout>> = new Map();

    /** Fires when the running timer runs out, to turn the day to dusk. */
    #expiryTimeout: ReturnType<typeof setTimeout>|null = null;

    constructor(model: ClocktowerModel){
        super();
        this.#model = model;
        this.#resolveSfx();
        this.#scheduleExpiry();
    }

    /** (Re)arms the timer that turns the day to dusk when the clock runs out. Night is only ever set from the remote. */
    #scheduleExpiry(){
        if(this.#expiryTimeout !== null){
            clearTimeout(this.#expiryTimeout);
            this.#expiryTimeout = null;
        }
        const startTime = this.#model.clock.time.serverStartTime;
        if(startTime === null) return;
        const remainingMs = startTime + this.#model.clock.time.duration * 1000 - Date.now();
        // Already run out (e.g. while the server was down): dusk falls straight away. Only from daytime, so it never
        // undoes a later phase set by hand (e.g. night set before the timer ran out, or before a restart).
        this.#expiryTimeout = setTimeout(()=>{
            this.#expiryTimeout = null;
            if(isDaytime(this.timeOfDay)) this.timeOfDay = 'dusk';
        }, Math.max(0, remainingMs));
    }

    /** Fills in audio.sfx from the clock's preset. Returns whether anything changed. */
    #resolveSfx(): boolean {
        const presetId = this.#model.config.clockSfxPresetId;
        const sfx = clockSfxPlaybackFor(presetId === null ? null : getClockSfxPreset(presetId));
        if(JSON.stringify(sfx) === JSON.stringify(this.#model.audio.sfx)) return false;
        this.#model.audio.sfx = sfx;
        return true;
    }

    /** Call when the clock's preset (or its sounds) changed, to send the new sounds to every client. */
    refreshSfx(){
        if(!this.#resolveSfx()) return;
        this.scheduleSave();
        this.debouncedEmit('audio', this.#model.audio);
    }

    on(event: 'audio', listener: (audio: ClocktowerAudioTrackModel) => void): this;
    /** `bell` is the sound to ring: 'final' for the bell rung by hand, 'start' when the game goes from night to daytime. */
    on(event: 'bellRingRequest', listener: (bell: 'start' | 'final') => void): this;
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

    get timeOfDay(): TimeOfDay { return this.#model.clock.timeOfDay; }

    set timeOfDay(timeOfDay: TimeOfDay){
        const previous = this.#model.clock.timeOfDay;
        if(previous === timeOfDay) return;
        this.#model.clock.timeOfDay = timeOfDay;
        if(previous === 'night' && isDaytime(timeOfDay)) this.emit('bellRingRequest', 'start');
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    get running(){
        return this.#model.clock.time.serverStartTime !== null;
    }

    private scheduleSave(){
        if(this.#closed) return;
        if(this.configSaveTimeout){
            clearTimeout(this.configSaveTimeout);
        }
        this.configSaveTimeout = setTimeout(()=>{
            if(this.#closed) return;
            CLOCK_CONFIG_MANAGER.add(this.#model);
            console.log("Config auto-saved for instance", this.id);
            this.configSaveTimeout = null;
        }, 5000); // save config 5 seconds after last change
    }


    get model(){ return this.#model }

    setup(timerOption: TimerOption) {
        console.log("Setting up clock...", timerOption);
        if(this.#model.clock.day === 0 || !isDaytime(this.timeOfDay)){
            // Day had ended, so advance to next day
            console.log("Advancing to next day...");
            this.day += 1;
        } else {
            console.log("No active timer, not advancing day.");
        }
        if(this.running) this.stop();
        this.duration = timerOption.duration;
        this.ringBellWhen = timerOption.ringBellWhenRemaining ?? undefined;
        this.#model.clock.time.setupDuration = timerOption.duration;
        this.#model.clock.time.setupRingBellWhen = timerOption.ringBellWhenRemaining ?? undefined;
        // Set up but not started yet
        this.timeOfDay = 'morning';
    }

    /**
     * Sets the timer up again as it was last set up (or as it is, if it never was), waiting in the morning to be
     * started - a new day, if the last one had ended.
     */
    resetDay() {
        const time = this.#model.clock.time;
        const setUp = time.setupDuration !== undefined;
        this.setup({
            label: null,
            duration: setUp ? time.setupDuration! : time.duration,
            ringBellWhenRemaining: (setUp ? time.setupRingBellWhen : time.ringBellWhen) ?? null
        });
    }

    start() {
        if (this.running) return;
        this.#model.clock.time.serverStartTime = Date.now();
        this.#scheduleExpiry();
        this.timeOfDay = 'day';
        this.emit('modelUpdated', this.#model);
    }

    stop() {
        // Stopping an already stopped (or run out) clock ends the day, running out the remaining time.
        if(!this.running || this.#expiryTimeout === null) return this.endDay();
        // Paused: back to morning until it's started again
        this.#model.clock.time.serverStartTime = null;
        this.#scheduleExpiry();
        if(this.timeOfDay === 'day') this.timeOfDay = 'morning';
        this.emit('modelUpdated', this.#model);
    }

    /**
     * Starts the game over, as a new game starts: dusk before the first night (day 0), with no timer. Going to the
     * morning then starts day 1.
     */
    newGame() {
        if(this.running){
            this.#model.clock.time.serverStartTime = null;
            this.#scheduleExpiry();
            this.emit('modelUpdated', this.#model);
        }
        if(this.duration !== 0) this.duration = 0;
        this.day = 0;
        this.timeOfDay = 'dusk';
    }

    /**
     * Ends the day now: stops any countdown, running out the time left, and turns daytime to dusk (or `to`, e.g. night).
     * Ending a countdown before it runs out rings the end of day bell, as running out would have.
     */
    endDay(to: 'dusk' | 'night' = 'dusk') {
        const counting = this.running && this.#expiryTimeout !== null;
        if(this.running){
            this.#model.clock.time.serverStartTime = null;
            this.#scheduleExpiry();
            this.emit('modelUpdated', this.#model);
        }
        if(this.duration !== 0) this.duration = 0;
        if(to === 'night' || isDaytime(this.timeOfDay)) this.timeOfDay = to;
        // After the change of phase reaches the clients (both are debounced, in order), so the town square says the day has ended
        if(counting) this.debouncedEmit('bellRingRequest', 'final');
    }

    /**
     * Gives the timer more time (or less, for negative seconds), whether it's counting down or waiting in the morning
     * (as it's set up for this day only: the next day's timer is set up as the option picked).
     * Never below the time already gone by: taking off more than is left runs it out now, turning the day to dusk.
     */
    adjustTime(seconds: number) {
        const time = this.#model.clock.time;
        // Only a timer still to run out: one set up in the morning, or counting down
        if(!isDaytime(this.timeOfDay) || (this.running && this.#expiryTimeout === null)) return;
        const elapsed = time.serverStartTime === null ? 0 : Math.ceil((Date.now() - time.serverStartTime) / 1000);
        const duration = Math.max(elapsed, time.duration + Math.round(seconds));
        if(duration === time.duration) return;
        this.duration = duration;
        this.#scheduleExpiry();
    }

    makeDaBellNoise(){
        this.emit('bellRingRequest', 'final');
    }


    get day(){ return this.#model.clock.day; }
    get duration() { return this.#model.clock.time.duration; }
    get ringBellWhen() { return this.#model.clock.time.ringBellWhen; }
    get playerCount() { return this.#model.clock.numPlayers; }
    get audioGain() { return this.#model.audio.gain; }
    get audioPan() { return this.#model.audio.pan; }
    get audioBalance() { return this.#model.audio.balance; }

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

    set day(day: number){
        this.#model.clock.day = day;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
    }

    set config(config: Config){
        this.#model.config = config;
        this.scheduleSave();
        this.debouncedEmit('modelUpdated', this.#model);
        if(this.#resolveSfx()) this.debouncedEmit('audio', this.#model.audio);
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

    /** Stops pending timers, so a freed clock doesn't fire (or save itself back) later. */
    close(){
        this.#closed = true;
        if(this.#expiryTimeout !== null) clearTimeout(this.#expiryTimeout);
        if(this.configSaveTimeout !== null) clearTimeout(this.configSaveTimeout);
        this.#expiryTimeout = null;
        this.configSaveTimeout = null;
    }

    get info(): ClockInstanceInfo{
        return {
            id: this.id,
            config: this.#model.config
        }
    }
};
