import type { CanvasStroke } from "$lib/components/DrawableCanvas2/types";
import type { GrimoireStateHistory, LoadedPreset, PlacedReminder, PlacedToken } from "$lib/resources/common/grimoireState";

// Undo for the grim, for this device's own changes. Rather than each action recording itself, the board is compared
// with how it was at the last checkpoint (the page makes one each time it saves), and what changed becomes one step.
// That's cheap: tokens, reminders and bluffs are a few small objects, and lines are compared by reference, so only
// the lines added or removed are ever copied.
//
// Undoing a step puts back only what it changed, on the board as it is now, so changes made since on other devices
// are kept: a token that was moved here and renamed elsewhere goes back to where it was with its new name. A step
// with nothing left to undo (say the token has since been removed elsewhere) is skipped for the one before it.

type TokenChange = { before: PlacedToken | null; after: PlacedToken | null };
type StrokeChange = { layer: number; added: CanvasStroke[]; removed: CanvasStroke[] };
type Step = {
    tokens: TokenChange[];
    reminders: { added: PlacedReminder[]; removed: PlacedReminder[] };
    strokes: StrokeChange[];
    preset: { before: LoadedPreset | null; after: LoadedPreset | null } | null;
};

const MAX_STEPS = 100;

const json = (v: unknown) => JSON.stringify(v);
const copy = <T>(v: T): T => $state.snapshot(v) as T;

export class GrimoireUndo {
    #steps = $state<Step[]>([]);
    // The board as of the last checkpoint
    #tokens = new Map<string, { key: string; token: PlacedToken }>();
    #reminders: PlacedReminder[] = [];
    #strokes: Set<CanvasStroke>[] = [];
    #preset = 'null';

    constructor(private readonly state: () => GrimoireStateHistory) {
        this.reset();
    }

    get canUndo() {
        return this.#steps.length > 0;
    }

    // Takes the board as it is now as the starting point for the next step, without making one (e.g. after taking in
    // another device's changes, which aren't this device's to undo).
    reset() {
        const { present, loadedPreset } = this.state();
        this.#tokens = new Map(present.placedTokens.map(t => [t.id, { key: json(t), token: copy(t) }]));
        this.#reminders = copy(present.placedReminders);
        this.#strokes = present.canvas.layers.map(l => new Set(l.strokes));
        this.#preset = json(loadedPreset);
    }

    // Makes a step of whatever has changed since the last checkpoint.
    checkpoint() {
        const { present, loadedPreset } = this.state();

        const tokens: TokenChange[] = [];
        const seen = new Set<string>();
        for (const t of present.placedTokens) {
            seen.add(t.id);
            const was = this.#tokens.get(t.id);
            if (!was) tokens.push({ before: null, after: copy(t) });
            else if (was.key !== json(t)) tokens.push({ before: was.token, after: copy(t) });
        }
        for (const [id, was] of this.#tokens) {
            if (!seen.has(id)) tokens.push({ before: was.token, after: null });
        }

        const reminders = multisetDiff(this.#reminders, present.placedReminders);

        const strokes: StrokeChange[] = [];
        if (present.canvas.layers.length === this.#strokes.length) {
            present.canvas.layers.forEach((layer, i) => {
                const was = this.#strokes[i];
                const now = new Set(layer.strokes);
                const added = layer.strokes.filter(s => !was.has(s));
                const removed = [...was].filter(s => !now.has(s));
                if (added.length || removed.length) strokes.push({ layer: i, added: added.map(copy), removed: removed.map(copy) });
            });
        } else {
            // A layer was added or deleted: the lines of earlier steps may no longer be on the layer they were drawn on
            for (const step of this.#steps) step.strokes = [];
        }

        const presetKey = json(loadedPreset);
        const preset = presetKey !== this.#preset ? { before: JSON.parse(this.#preset), after: copy(loadedPreset) } : null;

        if (tokens.length || reminders.added.length || reminders.removed.length || strokes.length || preset) {
            this.#steps.push({ tokens, reminders, strokes, preset });
            if (this.#steps.length > MAX_STEPS) this.#steps.shift();
        }
        this.reset();
    }

    // Undoes the latest step that still has something to undo. False if none did.
    undo(): boolean {
        this.checkpoint();
        while (this.#steps.length > 0) {
            const step = this.#steps.pop()!;
            if (this.#apply(step)) {
                this.reset();
                return true;
            }
        }
        return false;
    }

    #apply(step: Step): boolean {
        const history = this.state();
        const present = history.present;
        let changed = false;

        let tokens = [...present.placedTokens];
        for (const { before, after } of step.tokens) {
            const i = tokens.findIndex(t => t.id === (before ?? after)!.id);
            if (!before) {
                // Added here: take it off again
                if (i !== -1) { tokens.splice(i, 1); changed = true; }
            } else if (!after) {
                // Removed here: put it back, unless it's been put back already
                if (i === -1) { tokens.push(before); changed = true; }
            } else if (i !== -1) {
                // Changed here: change back what changed, leaving whatever else has changed since
                const reverted: Record<string, unknown> = { ...tokens[i] };
                for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
                    const was = (before as any)[key], then = (after as any)[key];
                    if (json(was) === json(then) || json(reverted[key]) === json(was)) continue;
                    if (was === undefined) delete reverted[key];
                    else reverted[key] = was;
                    changed = true;
                }
                tokens[i] = reverted as PlacedToken;
            }
        }
        if (changed) present.placedTokens = tokens;

        // Reminders: only if every one placed here is still where it was put (a moved reminder is one removed and
        // one placed, so this doesn't bring back the old one when someone else has since moved the new one).
        const reminders = [...present.placedReminders];
        const placedStillThere = step.reminders.added.every(r => {
            const i = reminders.findIndex(x => json(x) === json(r));
            if (i === -1) return false;
            reminders.splice(i, 1);
            return true;
        });
        if (placedStillThere && (step.reminders.added.length || step.reminders.removed.length)) {
            present.placedReminders = [...reminders, ...step.reminders.removed];
            changed = true;
        }

        for (const { layer: index, added, removed } of step.strokes) {
            const layer = present.canvas.layers[index];
            if (!layer) continue;
            const strokes = [...layer.strokes];
            let layerChanged = removed.length > 0;
            for (const stroke of added) {
                const key = json(stroke);
                const i = strokes.findIndex(s => s.points.length === stroke.points.length && json(s) === key);
                if (i !== -1) { strokes.splice(i, 1); layerChanged = true; }
            }
            if (layerChanged) {
                layer.strokes = [...strokes, ...removed];
                changed = true;
            }
        }

        // Bluff sets: only if nobody has changed them since
        if (step.preset && json(history.loadedPreset) === json(step.preset.after)) {
            history.loadedPreset = step.preset.before;
            changed = true;
        }

        return changed;
    }
}

function multisetDiff<T>(before: T[], after: T[]): { added: T[]; removed: T[] } {
    const remaining = new Map<string, T[]>();
    for (const item of before) {
        const key = json(item);
        remaining.set(key, [...(remaining.get(key) ?? []), item]);
    }
    const added: T[] = [];
    for (const item of after) {
        const left = remaining.get(json(item));
        if (left?.length) left.pop();
        else added.push(copy(item));
    }
    return { added, removed: [...remaining.values()].flat() };
}
