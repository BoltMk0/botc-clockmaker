import { EventEmitter } from "node:events";
import { clampMixerMastersField, isMixerMastersModel, MIXER_MASTERS_FIELDS, newMixerMastersModel, type MixerMastersModel } from "$lib/audio/common/model/mixerMastersModel";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

const CONFIG_MANAGER = new JSONSingletonResourceManager<MixerMastersModel>('mixer_masters', isMixerMastersModel);

export class MixerMastersHelper extends EventEmitter {
    #model: MixerMastersModel = { ...newMixerMastersModel(), ...CONFIG_MANAGER.value };

    on(eventName: 'update', listener: (model: MixerMastersModel) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get model(): MixerMastersModel { return { ...this.#model }; }

    /** Validates and applies a patch ({ mainGain?, clocksGain?, clocksPan? }). Throws on an invalid field. */
    update(patch: Record<string, unknown>) {
        let changed = false;
        for (const field of MIXER_MASTERS_FIELDS) {
            const value = patch[field];
            if (value === undefined) continue;
            if (typeof value !== 'number' || !isFinite(value)) throw new Error(`Invalid ${field}`);
            const clamped = clampMixerMastersField(field, value);
            if (this.#model[field] !== clamped) { this.#model[field] = clamped; changed = true; }
        }
        if (changed) {
            CONFIG_MANAGER.save(this.model);
            this.emit('update', this.model);
        }
    }
}

var instance: MixerMastersHelper;

export function getMixerMastersHelperInstance() {
    if (instance === undefined) {
        instance = new MixerMastersHelper();
    }
    return instance;
}
