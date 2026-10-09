import { clampMixerMastersField, MIXER_MASTERS_FIELDS, newMixerMastersModel, type MixerMastersField, type MixerMastersModel } from "$lib/audio/common/model/mixerMastersModel";
import { subscribeMixerEvents } from "./MixerEventsClient";

/** Outgoing edits are batched for this long, so dragging a fader doesn't flood the server. */
const SEND_DELAY_MS = 80;
/** Incoming values for a field are ignored for this long after editing it locally, so stale echoes don't fight the user's fader. */
const LOCAL_EDIT_HOLD_MS = 500;

/** Client side of the shared master faders: follows the server's state, and edits it for everyone. */
export class MixerMasters {
    model = $state<MixerMastersModel>(newMixerMastersModel());

    readonly #unsubscribeEvents: () => void;
    #pending: Partial<MixerMastersModel> = {};
    #sendTimer: ReturnType<typeof setTimeout>|null = null;
    #localEdits = new Map<MixerMastersField, number>();

    constructor() {
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type !== 'mixerMastersUpdate') return;
            const now = Date.now();
            for (const field of MIXER_MASTERS_FIELDS) {
                const editedAt = this.#localEdits.get(field);
                if (editedAt !== undefined && now - editedAt < LOCAL_EDIT_HOLD_MS) continue;
                this.model[field] = msg.model[field];
            }
        });
    }

    set(field: MixerMastersField, value: number) {
        if (!isFinite(value)) return;
        value = clampMixerMastersField(field, value);
        this.model[field] = value; // Optimistic; the server's echo confirms it
        this.#pending[field] = value;
        this.#localEdits.set(field, Date.now());
        if (this.#sendTimer !== null) return;
        this.#sendTimer = setTimeout(() => {
            this.#sendTimer = null;
            this.#flush();
        }, SEND_DELAY_MS);
    }

    #flush() {
        const patch = this.#pending;
        this.#pending = {};
        if (Object.keys(patch).length === 0) return;
        fetch('/api/mixerMasters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        }).then((res) => {
            if (!res.ok) console.error(`MixerMasters - update rejected: ${res.status}`);
        }).catch((e) => {
            console.error('MixerMasters - failed to send update', e);
        });
    }

    close() {
        if (this.#sendTimer !== null) {
            clearTimeout(this.#sendTimer);
            this.#sendTimer = null;
            this.#flush(); // Don't lose the last edit
        }
        this.#unsubscribeEvents();
    }
}
