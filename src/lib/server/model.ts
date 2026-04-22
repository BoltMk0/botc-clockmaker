import type { ClockMessage } from '$lib/common/comms';
import { getDefaultConfig, type ClockInstanceInfo, type Config } from '$lib/common/config';
import { EventEmitter } from 'node:events';
import { v7 } from 'uuid';
import type { AudioParams } from '$lib/common/AudioParams';
import { listClockConfigResources, setClockConfigResource } from '$lib/resources/server/clock-config';
import { getResourceData } from '$lib/resources/server/resources';

console.log("Loading BOTCTClock model...");


export class BOTCTClock extends EventEmitter {
    timer_info: {startTime: number|null; duration: number; ringBellAfter: number|null}|null = null;
    day_info: {day: number; max: number} = {day: 0, max: 8};
    playerCount: number = 0;

    private configSaveTimeout: NodeJS.Timeout | null = null;

    constructor(public readonly id: string, private config: Config){
        super();
    }

    on(event: 'dayChanged', listener: (dayInfo: {day: number; max: number}) => void): this;
    on(event: 'playerCountChanged', listener: (playerCount: number)=>void): this;
    on(event: 'bellRingRequest', listener: () => void): this;
    on(event: 'stateChanged', listener: (state: ClockMessage) => void): this;
    on(event: 'audioParamsChanged', listener: (params: AudioParams) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    private running(){
        return this.timer_info !== null && this.timer_info.startTime !== null;
    }

    private scheduleConfigSave(){
        if(this.configSaveTimeout){
            clearTimeout(this.configSaveTimeout);
        }
        this.configSaveTimeout = setTimeout(()=>{
            setClockConfigResource(this.id, Buffer.from(JSON.stringify(this.config)), 'application/json');
            console.log("Config auto-saved for instance", this.id);
            this.configSaveTimeout = null;
        }, 5000); // save config 5 seconds after last change
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
        if(this.day_info.day === 0 || this.timer_info && this.timer_info.startTime !== null && this.timer_info.startTime + this.timer_info.duration < Date.now()){
            // Day had ended, so advance to next day
            console.log("Advancing to next day...");
            this.setDay(this.day_info.day + 1, this.day_info.max);
        } else {
            console.log("No active timer, not advancing day.", this.timer_info);
        }
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

    getConfig(){
        return this.config;
    }

    setConfig(config: Config, save: boolean = true){
        this.config = config;
        if (save) {
            this.scheduleConfigSave();
        }
    }

    setAudioParams(params: AudioParams){
        this.config.audioParams = params;
        this.scheduleConfigSave();
        this.emit('audioParamsChanged', this.config.audioParams);
    }

    setAudioGain(gain: number){
        this.config.audioParams.gain = gain;
        this.scheduleConfigSave();
        this.emit('audioParamsChanged', this.config.audioParams);
    }

    setAudioPan(pan: number){
        this.config.audioParams.pan = pan;
        this.scheduleConfigSave();
        this.emit('audioParamsChanged', this.config.audioParams);
    }

    setPlayerCount(playerCount: number){
        this.playerCount = playerCount;
        this.emit('playerCountChanged', this.playerCount);
    }

    get gain(){
        return this.config.audioParams.gain;
    }

    get pan(){
        return this.config.audioParams.pan;
    }

    get audioSettings(){
        return this.config.audioParams;
    }
};

export class ClockError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ClockError";
    }
}

export class InstanceNotFoundError extends ClockError {
    constructor(instanceId: string) {
        super(`No instance found with id: ${instanceId}`);
        this.name = "InstanceNotFoundError";
    }
}


class ClockInstanceManager extends EventEmitter {
    private instances: Map<string, BOTCTClock> = new Map();

    constructor(){
        super();
        const configResources = listClockConfigResources();
        for(const res of configResources){
            const config = getResourceData(res);
            if(!config){
                console.warn(`Failed to load config resource ${res.name} (id: ${res.id}), skipping...`);
                continue;
            }
            let parsedConfig: Config;
            try {
                parsedConfig = JSON.parse(config.toString()) as Config;
            } catch (e) {
                console.warn(`Failed to parse config resource ${res.name} (id: ${res.id}), skipping...`, e);
                continue;
            }
            const instance = new BOTCTClock(res.clockid, parsedConfig);
            this.instances.set(res.clockid, instance);
            console.log(`Loaded BOTCTClock instance with id: ${res.clockid} from config.`);
        }
        if(!this.hasInstance('default')){
            const {id, instance} = this.newInstance('default');
            instance.setConfig(getDefaultConfig());
            console.log("Created default BOTCTClock instance with id: default");
        }
    }

    listInstances(): ClockInstanceInfo[] {
        return Array.from(this.instances.values()).map(instance => ({id: instance.id, config: instance.getConfig(), audioParams: instance.audioSettings}));
    }

    newInstance(id?: string): {id: string, instance: BOTCTClock} {
        const instanceId = id ?? v7();
        if(this.instances.has(instanceId)){
            throw new Error(`Instance with id ${instanceId} already exists.`);
        }
        const instance = new BOTCTClock(instanceId, getDefaultConfig());
        const cfg = instance.getConfig();
        cfg.teamName = `Team ${this.instances.size + 1}`;
        cfg.theme.hue = (this.instances.size * 137) % 360; // use golden angle to distribute hues
        this.instances.set(instanceId, instance);
        this.emit('instanceCreated', instanceId, instance);
        console.log(`Created new BOTCTClock instance with id: ${instanceId}`);
        return {id: instanceId, instance};
    }

    hasInstance(id: string): boolean {
        return this.instances.has(id);
    }

    getInstance(id: string): BOTCTClock {
        const instance = this.instances.get(id);
        if(instance===undefined){
            throw new InstanceNotFoundError(id);
        }
        return instance;
    }

    freeInstance(id: string) {
        console.log(`Freeing BOTCTClock instance with id: ${id}`);
        const instance = this.getInstance(id);
        if (instance) {
            instance.removeAllListeners();
            this.emit('instanceFreed', id);
        }
        this.instances.delete(id);
    }

    on(event: 'instanceCreated', listener: (id: string, instance: BOTCTClock) => void): this;
    on(event: 'instanceFreed', listener: (id: string) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
}

let clock_instance_manager: ClockInstanceManager | null = null;

export function getBOTCTClockInstanceManager(): ClockInstanceManager {
    if (clock_instance_manager === null) {
        clock_instance_manager = new ClockInstanceManager();
    }
    return clock_instance_manager;
}
