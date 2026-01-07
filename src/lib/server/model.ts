import type { ClockMessage } from '$lib/common/comms';
import { EventEmitter } from 'node:events';

console.log("Loading BOTCTClock model...");

export class BOTCTClock extends EventEmitter {
    running: boolean = false;
    startTime: number = 0;
    duration: number = 0;
    ringBellAfter: number|null = null;

    day_info: {day: number; max: number} = {day: 0, max: 8};

    constructor(){
        super();
    }

    on(event: 'dayChanged', listener: (dayInfo: {day: number; max: number}) => void): this;
    on(event: 'bellRingRequest', listener: () => void): this;
    on(event: 'stateChanged', listener: (state: ClockMessage) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }


    getState(): ClockMessage {
        return {
            type: 'clock',
            running: this.running,
            startTime: this.startTime,
            duration: this.duration,
            ringBellAfter: this.ringBellAfter
        };
    }

    setup(duration: number, {ringBellAfter = null}: {ringBellAfter?: number|null} = {}) {
        console.log("Setting up clock...", {duration, ringBellAfter});
        this.running = false;
        this.startTime = Date.now();        
        this.duration = duration;
        this.ringBellAfter = ringBellAfter;
        this.emit('stateChanged', this.getState());
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.startTime = Date.now();
        this.emit('stateChanged', this.getState());
    }

    stop() {
        if (!this.running) return;
        this.running = false;
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