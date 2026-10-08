import { clampTimeOfDayTrim, newTimeOfDayTrimModel, timeOfDayTrimGain, type TimeOfDayTrimModel } from "$lib/audio/common/model/timeOfDayTrimModel";
import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
import { subscribeMixerEvents } from "./MixerEventsClient";

/** Outgoing edits are batched for this long, so turning a knob doesn't flood the server. */
const SEND_DELAY_MS = 80;
/** Incoming values for a phase are ignored for this long after editing it locally, so stale echoes don't fight the user's knob. */
const LOCAL_EDIT_HOLD_MS = 500;

/** Client side of the shared per-phase master trims: follows the server's state, and edits it for everyone. */
export class TimeOfDayTrim {
    model = $state<TimeOfDayTrimModel>(newTimeOfDayTrimModel());

    readonly #unsubscribeEvents: () => void;
    #pending: Partial<TimeOfDayTrimModel> = {};
    #sendTimer: ReturnType<typeof setTimeout>|null = null;
    #localEdits = new Map<TimeOfDay, number>();

    constructor() {
        this.#unsubscribeEvents = subscribeMixerEvents((msg) => {
            if (msg.type !== 'timeOfDayTrimUpdate') return;
            const now = Date.now();
            for (const phase of TIMES_OF_DAY) {
                const editedAt = this.#localEdits.get(phase);
                if (editedAt !== undefined && now - editedAt < LOCAL_EDIT_HOLD_MS) continue;
                this.model[phase] = msg.model[phase];
            }
        });
    }

    /** Linear gain multiplier for a phase's trim. */
    gain(timeOfDay: TimeOfDay) { return timeOfDayTrimGain(this.model, timeOfDay); }

    set(timeOfDay: TimeOfDay, db: number) {
        db = clampTimeOfDayTrim(db);
        this.model[timeOfDay] = db; // Optimistic; the server's echo confirms it
        this.#pending[timeOfDay] = db;
        this.#localEdits.set(timeOfDay, Date.now());
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
        fetch('/api/timeOfDayTrim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        }).then((res) => {
            if (!res.ok) console.error(`TimeOfDayTrim - update rejected: ${res.status}`);
        }).catch((e) => {
            console.error('TimeOfDayTrim - failed to send update', e);
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
