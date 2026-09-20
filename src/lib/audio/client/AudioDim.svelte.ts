import { dimGain, DEFAULT_DIM_AMOUNT_DB, type AudioDimModel } from "$lib/audio/common/model/audioDimModel";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

/** Client side of the shared audio dim: follows the server's state, and can switch it for everyone. */
export class AudioDim {
    model = $state<AudioDimModel>({ dimmed: false, amountDb: DEFAULT_DIM_AMOUNT_DB });

    readonly #sse: SSEClient;

    constructor() {
        this.#sse = new SSEClient('/api/audioDim/events', (msg) => {
            if (msg.type === 'audioDimUpdate') this.model = msg.model;
        });
    }

    get dimmed() { return this.model.dimmed; }
    get amountDb() { return this.model.amountDb; }
    /** Linear gain multiplier to apply to local output (1 when not dimmed). */
    get gain() { return dimGain(this.model); }

    set dimmed(dimmed: boolean) {
        this.model.dimmed = dimmed; // Optimistic; the server's echo confirms it
        fetch('/api/audioDim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dimmed })
        }).then((res) => {
            if (!res.ok) console.error(`AudioDim - update rejected: ${res.status}`);
        }).catch((e) => {
            console.error('AudioDim - failed to send update', e);
        });
    }

    toggle() { this.dimmed = !this.dimmed; }

    close() { this.#sse.close(); }
}
