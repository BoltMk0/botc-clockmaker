import type { TimeOfDay } from "$lib/model/client/types";

/**
 * `start`: the start of the day (when a game goes from night to day). `final`: the end of the day (the timer running
 * out, or the bell rung by hand). `reminder`: the warning ahead of the end of the day.
 */
export type ClockSfxSlot = 'start' | 'final' | 'reminder';
/** In the order they play through a day, which is the order they're listed in. */
export const CLOCK_SFX_SLOTS: readonly ClockSfxSlot[] = ['start', 'reminder', 'final'] as const;

export const CLOCK_SFX_SLOT_LABELS: Record<ClockSfxSlot, string> = {
    start: 'Start of Day',
    final: 'End of Day',
    reminder: 'Reminder Bell'
};

/** The phase whose icon marks each slot: the day starting, drawing to a close, and over. */
export const CLOCK_SFX_SLOT_TIMES_OF_DAY: Record<ClockSfxSlot, TimeOfDay> = {
    start: 'day',
    reminder: 'dusk',
    final: 'night'
};

export function isClockSfxSlot(value: any): value is ClockSfxSlot {
    return CLOCK_SFX_SLOTS.includes(value);
}

/** An uploaded sound, stored as `<presetId>-<slot><ext>`. `version` changes on every upload, to bust caches. */
export type ClockSfxFile = {
    ext: string;
    version: number;
};

function isClockSfxFile(data: any): data is ClockSfxFile {
    return typeof data === 'object' && data !== null
        && typeof data.ext === 'string'
        && typeof data.version === 'number';
}

/**
 * The bell sounds a game's clock rings, shared between games. gain/balance/pan are a trim applied on top of
 * each clock's own mixer channel (e.g. to even out a loud file once, rather than in every game).
 */
export type ClockSfxPreset = {
    id: string;
    name: string;
    /** Presets are listed oldest first, and new games default to the first. */
    createdAt: number;
    start: ClockSfxFile | null;
    final: ClockSfxFile | null;
    reminder: ClockSfxFile | null;
    gain: number;
    balance: number;
    pan: number;
};

export function isClockSfxPreset(data: any): data is ClockSfxPreset {
    if(typeof data !== 'object' || data === null) return false;
    if(typeof data.id !== 'string') return false;
    if(typeof data.name !== 'string') return false;
    if(typeof data.createdAt !== 'number') return false;
    if(data.start !== null && !isClockSfxFile(data.start)) return false;
    if(data.final !== null && !isClockSfxFile(data.final)) return false;
    if(data.reminder !== null && !isClockSfxFile(data.reminder)) return false;
    if(typeof data.gain !== 'number') return false;
    if(typeof data.balance !== 'number') return false;
    if(typeof data.pan !== 'number') return false;
    return true;
}

export function clockSfxFileUrl(presetId: string, slot: ClockSfxSlot, file: ClockSfxFile): string {
    return `/api/clockSfx/${encodeURIComponent(presetId)}/${slot}?v=${file.version}`;
}

/** Upgrades, in place, a saved preset from before the start of day sound. */
export function migrateLegacyClockSfxPreset(data: any) {
    if(typeof data === 'object' && data !== null && data.start === undefined) data.start = null;
}

/** What a clock's audio track needs to play its preset's bells, resolved by the server from the clock's preset. */
export type ClockSfxPlayback = {
    startUrl: string | null;
    finalUrl: string | null;
    reminderUrl: string | null;
    gain: number;
    balance: number;
    pan: number;
};

export const NO_CLOCK_SFX: ClockSfxPlayback = { startUrl: null, finalUrl: null, reminderUrl: null, gain: 1, balance: 0, pan: 0 };

export function isClockSfxPlayback(data: any): data is ClockSfxPlayback {
    if(typeof data !== 'object' || data === null) return false;
    if(typeof data.startUrl !== 'string' && data.startUrl !== null) return false;
    if(typeof data.finalUrl !== 'string' && data.finalUrl !== null) return false;
    if(typeof data.reminderUrl !== 'string' && data.reminderUrl !== null) return false;
    if(typeof data.gain !== 'number') return false;
    if(typeof data.balance !== 'number') return false;
    if(typeof data.pan !== 'number') return false;
    return true;
}

export function clockSfxPlaybackFor(preset: ClockSfxPreset | null | undefined): ClockSfxPlayback {
    if(!preset) return { ...NO_CLOCK_SFX };
    return {
        startUrl: preset.start ? clockSfxFileUrl(preset.id, 'start', preset.start) : null,
        finalUrl: preset.final ? clockSfxFileUrl(preset.id, 'final', preset.final) : null,
        reminderUrl: preset.reminder ? clockSfxFileUrl(preset.id, 'reminder', preset.reminder) : null,
        gain: preset.gain,
        balance: preset.balance,
        pan: preset.pan
    };
}

/**
 * Balance in [-1, 1]: negative favours the reminder bell, positive the start and end of day sounds (equal-power).
 */
export function bellBalanceGains(balance: number): Record<ClockSfxSlot, number> {
    const dayBoundary = balance > 0 ? 1 : Math.cos(Math.PI/2 * Math.abs(balance));
    return {
        start: dayBoundary,
        final: dayBoundary,
        reminder: balance < 0 ? 1 : Math.cos(Math.PI/2 * Math.abs(balance))
    };
}
