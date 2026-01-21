import type { ClockMessage } from '$lib/common/comms';
import { getDefaultConfig, type Config } from '$lib/common/config';
import { EventEmitter } from 'node:events';
import { loadConfigFromFile, saveConfigToFile } from './config';

console.log("Loading BOTCTClock model...");

export class BOTCTClock extends EventEmitter {
    config: Config
    timer_info: {startTime: number|null; duration: number; ringBellAfter: number|null}|null = null;
    day_info: {day: number; max: number} = {day: 0, max: 8};

    constructor(){
        super();
        try {
            this.config = loadConfigFromFile()
        } catch (e) {
            console.error("Error loading config file, using default config.", e);
            this.config = getDefaultConfig();
            saveConfigToFile(this.config);
        }
    }

    on(event: 'dayChanged', listener: (dayInfo: {day: number; max: number}) => void): this;
    on(event: 'bellRingRequest', listener: () => void): this;
    on(event: 'stateChanged', listener: (state: ClockMessage) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    private running(){
        return this.timer_info !== null && this.timer_info.startTime !== null;
    }


    getState(): ClockMessage {
        return {
            type: 'clock',
            running: this.running(),
            startTime: this.timer_info?.startTime ?? 0,
            duration: this.timer_info?.duration ?? 0,
            ringBellAfter: this.timer_info?.ringBellAfter ?? null
        };
    }

    setup(duration: number, {ringBellAfter = null}: {ringBellAfter?: number|null} = {}) {
        console.log("Setting up clock...", {duration, ringBellAfter});
        this.timer_info = {startTime: null, duration, ringBellAfter};
        this.emit('stateChanged', this.getState());
    }

    start() {
        if (this.running()) return;
        if( this.timer_info === null ) {
            throw new Error("Cannot start clock that has not been set up.");
        }
        this.timer_info.startTime = Date.now();
        this.emit('stateChanged', this.getState());
    }

    stop() {
        if (!this.running() || this.timer_info === null) return;
        this.timer_info.startTime = null;
        this.emit('stateChanged', this.getState());
    }

    setDay(day: number, max: number) {
        this.day_info = {day, max};
        this.emit('dayChanged', this.day_info);
    }

    makeDaBellNoise(){
        this.emit('bellRingRequest');
    }
};

let clock_instance: BOTCTClock | null = null;

export function getBOTCTClockInstance(): BOTCTClock {
    if (clock_instance === null) {
        clock_instance = new BOTCTClock();
    }
    return clock_instance;
}