import type { CanvasLayer } from "$lib/components/DrawableCanvas2/types";
import type { GrimoireStateHistory, GrimoireStateSnapshot, PlacedReminder, PlacedToken } from "./grimoireState";

// Merging grimoires edited on two devices at once. Each device keeps the last state it agreed with the server (the
// base); when someone else's newer state arrives, the changes this device has made since the base are replayed onto
// it, so neither side's edits are lost:
// - tokens are matched by id and merged field by field (one device moving a token while another renames it keeps both);
// - reminders and strokes have no ids, so they're treated as sets: whatever this device added is added, whatever it
//   removed is removed, and everything the other device did is kept;
// - anything else is taken from this device if it changed it, otherwise from the other.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Changed here since the base ? ours : theirs
function pick<T>(base: T, local: T, remote: T): T {
    return same(local, base) ? remote : local;
}

function mergeTokens(base: PlacedToken[], local: PlacedToken[], remote: PlacedToken[]): PlacedToken[] {
    const baseById = new Map(base.map(t => [t.id, t]));
    const localById = new Map(local.map(t => [t.id, t]));
    const remoteIds = new Set(remote.map(t => t.id));
    const merged: PlacedToken[] = [];
    for (const theirs of remote) {
        const was = baseById.get(theirs.id);
        const ours = localById.get(theirs.id);
        if (!was) {
            merged.push(theirs);
        } else if (ours) {
            merged.push(mergeFields(was, ours, theirs));
        }
        // In the base but no longer here: removed on this device.
    }
    // Added on this device. (One removed on the other device stays removed, even if it was changed here.)
    for (const ours of local) {
        if (!baseById.has(ours.id) && !remoteIds.has(ours.id)) merged.push(ours);
    }
    return merged;
}

function mergeFields<T extends object>(base: T, local: T, remote: T): T {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
        const value = pick((base as any)[key], (local as any)[key], (remote as any)[key]);
        if (value !== undefined) result[key] = value;
    }
    return result as T;
}

// Theirs, less what this device removed, plus what it added. Duplicates count, so two equal items are two items; a
// change both sides made (e.g. the other device had already merged this one's) is only made once.
function mergeAsSet<T>(base: T[], local: T[], remote: T[]): T[] {
    const counts = (items: T[]) => {
        const map = new Map<string, number>();
        for (const item of items) {
            const key = JSON.stringify(item);
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return map;
    };
    const [b, l, r] = [counts(base), counts(local), counts(remote)];
    const wanted = (key: string) => {
        const [was, ours, theirs] = [b.get(key) ?? 0, l.get(key) ?? 0, r.get(key) ?? 0];
        if (ours === was) return theirs;
        if (theirs === was || theirs === ours) return ours;
        return Math.max(0, theirs + ours - was);
    };
    const taken = new Map<string, number>();
    const merged: T[] = [];
    // In their order, then whatever only this device has
    for (const item of [...remote, ...local]) {
        const key = JSON.stringify(item);
        const n = taken.get(key) ?? 0;
        if (n < wanted(key)) {
            taken.set(key, n + 1);
            merged.push(item);
        }
    }
    return merged;
}

function mergeLayers(base: CanvasLayer[], local: CanvasLayer[], remote: CanvasLayer[]): CanvasLayer[] {
    // Layers added or deleted on this device: its set of layers wins, otherwise theirs. The strokes of every layer
    // that both have and the base had are merged.
    const layers = local.length !== base.length ? local : remote;
    return layers.map((layer, i) => {
        if (i >= base.length || i >= local.length || i >= remote.length) return layer;
        return { ...layer, strokes: mergeAsSet(base[i].strokes, local[i].strokes, remote[i].strokes) };
    });
}

function mergeSnapshots(base: GrimoireStateSnapshot, local: GrimoireStateSnapshot, remote: GrimoireStateSnapshot): GrimoireStateSnapshot {
    // This device loaded a save slot (a new snapshot): it replaces the board wholesale.
    if (local.id !== base.id) return local;
    return {
        ...remote,
        timestamp: Math.max(local.timestamp, remote.timestamp),
        placedTokens: mergeTokens(base.placedTokens, local.placedTokens, remote.placedTokens),
        placedReminders: mergeAsSet<PlacedReminder>(base.placedReminders, local.placedReminders, remote.placedReminders),
        canvas: { ...remote.canvas, layers: mergeLayers(base.canvas.layers, local.canvas.layers, remote.canvas.layers) }
    };
}

export function mergeGrimoireHistories(base: GrimoireStateHistory, local: GrimoireStateHistory, remote: GrimoireStateHistory): GrimoireStateHistory {
    return {
        ...remote,
        scriptId: pick(base.scriptId, local.scriptId, remote.scriptId),
        loadedPreset: pick(base.loadedPreset, local.loadedPreset, remote.loadedPreset),
        saveslots: pick(base.saveslots, local.saveslots, remote.saveslots),
        present: mergeSnapshots(base.present, local.present, remote.present)
    };
}
