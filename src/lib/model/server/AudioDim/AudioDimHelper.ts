import { EventEmitter } from "node:events";
import { clampDimAmount, DEFAULT_DIM_AMOUNT_DB, type AudioDimModel } from "$lib/audio/common/model/audioDimModel";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

type AudioDimConfig = { amountDb: number };

function isAudioDimConfig(value: unknown): value is AudioDimConfig {
    return typeof value === 'object' && value !== null && typeof (value as AudioDimConfig).amountDb === 'number';
}

const CONFIG_MANAGER = new JSONSingletonResourceManager<AudioDimConfig>('audio_dim_config', isAudioDimConfig);

export class AudioDimHelper extends EventEmitter {
    // Whether we're dimmed isn't persisted: a restart should come back at full volume.
    // A saved amount from before the range was narrowed is pulled back into it.
    #model: AudioDimModel = { dimmed: false, amountDb: clampDimAmount(CONFIG_MANAGER.value?.amountDb ?? DEFAULT_DIM_AMOUNT_DB) };

    on(eventName: 'update', listener: (model: AudioDimModel) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(eventName, listener);
    }

    get model(): AudioDimModel { return { ...this.#model }; }

    /** Validates and applies a patch ({ dimmed?, amountDb? }). Throws on an invalid field. */
    update(patch: Record<string, unknown>) {
        let changed = false;
        if (patch.dimmed !== undefined) {
            if (typeof patch.dimmed !== 'boolean') throw new Error('Invalid dimmed');
            if (this.#model.dimmed !== patch.dimmed) { this.#model.dimmed = patch.dimmed; changed = true; }
        }
        if (patch.amountDb !== undefined) {
            if (typeof patch.amountDb !== 'number' || isNaN(patch.amountDb)) throw new Error('Invalid amountDb');
            const amountDb = clampDimAmount(patch.amountDb);
            if (this.#model.amountDb !== amountDb) {
                this.#model.amountDb = amountDb;
                CONFIG_MANAGER.save({ amountDb });
                changed = true;
            }
        }
        if (changed) this.emit('update', this.model);
    }
}

var instance: AudioDimHelper;

export function getAudioDimHelperInstance() {
    if (instance === undefined) {
        instance = new AudioDimHelper();
    }
    return instance;
}
