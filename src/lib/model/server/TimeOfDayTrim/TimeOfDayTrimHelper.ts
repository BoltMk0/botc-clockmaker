import { EventEmitter } from "node:events";
import { clampTimeOfDayTrim, isTimeOfDayTrimModel, newTimeOfDayTrimModel, type TimeOfDayTrimModel } from "$lib/audio/common/model/timeOfDayTrimModel";
import { TIMES_OF_DAY } from "$lib/model/client/types";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

const CONFIG_MANAGER = new JSONSingletonResourceManager<TimeOfDayTrimModel>('time_of_day_trim', isTimeOfDayTrimModel);

export class TimeOfDayTrimHelper extends EventEmitter {
    #model: TimeOfDayTrimModel = { ...newTimeOfDayTrimModel(), ...CONFIG_MANAGER.value };

    on(eventName: 'update', listener: (model: TimeOfDayTrimModel) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get model(): TimeOfDayTrimModel { return { ...this.#model }; }

    /** Validates and applies a patch ({ day?, dusk?, night? } in dB). Throws on an invalid field. */
    update(patch: Record<string, unknown>) {
        let changed = false;
        for (const phase of TIMES_OF_DAY) {
            const db = patch[phase];
            if (db === undefined) continue;
            if (typeof db !== 'number' || !isFinite(db)) throw new Error(`Invalid ${phase}`);
            const clamped = clampTimeOfDayTrim(db);
            if (this.#model[phase] !== clamped) { this.#model[phase] = clamped; changed = true; }
        }
        if (changed) {
            CONFIG_MANAGER.save(this.model);
            this.emit('update', this.model);
        }
    }
}

var instance: TimeOfDayTrimHelper;

export function getTimeOfDayTrimHelperInstance() {
    if (instance === undefined) {
        instance = new TimeOfDayTrimHelper();
    }
    return instance;
}
