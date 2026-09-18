import { getDefaultConfig, isConfig, type Config } from '$lib/common/config';
import { EventEmitter } from 'node:events';
import { v7 } from 'uuid';
import { CLOCK_CONFIG_MANAGER } from '$lib/resources/server/clock-config';
import { newClocktowerModel, type ClocktowerModel } from '../common/ClocktowerModel';
import { BOTCTClock } from './BOTCClock';


console.log("Loading BOTCTClock model...");

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

export class InvalidConfigError extends ClockError {
    constructor(config: any) {
        super(`Invalid config: ${config}`);
        this.name = "InvalidConfigError";
    }
}

class ClockInstanceManager extends EventEmitter {
    private instances: Map<string, BOTCTClock> = new Map();

    constructor(){
        super();
        const configs = CLOCK_CONFIG_MANAGER.values;
        console.log(`Loading ${configs.length} clock config resources...`)
        for(const model of configs){
            const instance = new BOTCTClock(model);
            this.instances.set(model.clock.clockId, instance);
            console.log(`Loaded BOTCTClock instance with id: ${model.clock.clockId} from config.`);
        }
        if(!this.hasInstance('default')){
            const {id, instance} = this.newInstance('default');
            console.log("Created default BOTCTClock instance with id: default");
        }
    }

    listInstances(): ClocktowerModel[] {
        return Array.from(this.instances.values()).map(instance => (instance.model));
    }

    newInstance(id?: string): {id: string, instance: BOTCTClock} {
        const instanceId = id ?? v7();
        if(this.instances.has(instanceId)){
            throw new Error(`Instance with id ${instanceId} already exists.`);
        }
        
        const model: ClocktowerModel = newClocktowerModel(instanceId);
        model.config.teamName = `Team ${this.instances.size + 1}`;
        model.config.theme.hue = (this.instances.size * 137) % 360; // use golden angle to distribute hues

        const instance = new BOTCTClock(model);
        instance.save();
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
            this.emit('instanceFreed', id);
        }
        CLOCK_CONFIG_MANAGER.delete(id);
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
