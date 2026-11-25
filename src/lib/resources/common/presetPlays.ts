import { validateGrimoireState, type GrimoireStateSnapshot } from "./grimoireState";

export type PresetWinner = 'good' | 'evil';

/** One game played from a preset. */
export type PresetPlay = {
    id: string;
    preset_id: string;
    /** The day it was played, as YYYY-MM-DD. */
    date: string;
    winner: PresetWinner;
    /** The virtual grim as it was when the game was ended from it; absent for games logged by hand. */
    grim?: {
        script_id: string | null;
        snapshot: GrimoireStateSnapshot;
        /** The clock's in-game day when the game ended; absent when it wasn't known or the game hadn't started. */
        day?: number;
    };
};

/** A play as sent to the preset page: just whether it has a grim snapshot, not the snapshot itself. */
export type PresetPlaySummary = Omit<PresetPlay, 'grim'> & { has_grim: boolean };

export function isPresetWinner(value: unknown): value is PresetWinner {
    return value === 'good' || value === 'evil';
}

export function isPlayDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function isPresetPlay(obj: any): obj is PresetPlay {
    return !!obj && typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.preset_id === 'string' &&
        isPlayDate(obj.date) &&
        isPresetWinner(obj.winner) &&
        (obj.grim === undefined || (
            typeof obj.grim === 'object' &&
            (obj.grim.script_id === null || typeof obj.grim.script_id === 'string') &&
            (obj.grim.day === undefined || (Number.isInteger(obj.grim.day) && obj.grim.day > 0)) &&
            validateGrimoireState(obj.grim.snapshot)
        ));
}

/** Today's date in the local time zone, as YYYY-MM-DD. */
export function todayPlayDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
