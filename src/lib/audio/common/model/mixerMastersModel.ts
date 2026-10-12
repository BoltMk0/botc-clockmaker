/**
 * The mixers' shared master faders: the Music & Ambience master (which Spotify follows too) and the SFX (clocks and
 * sting) master. Gains are linear. Shared across every client, like the dim and the time-of-day trims; only the
 * mutes stay local to each device.
 */
export type MixerMastersModel = {
    mainGain: number;
    clocksGain: number;
    clocksPan: number;
};

export const MIXER_MASTERS_FIELDS = ['mainGain', 'clocksGain', 'clocksPan'] as const;
export type MixerMastersField = typeof MIXER_MASTERS_FIELDS[number];

/** Well above the faders' +12dB top end; just keeps a bad value from blowing anyone's ears out. */
const MAX_GAIN = 16;

export function newMixerMastersModel(): MixerMastersModel {
    return { mainGain: 1, clocksGain: 1, clocksPan: 0 };
}

export function clampMixerMastersField(field: MixerMastersField, value: number): number {
    if (field === 'clocksPan') return Math.min(1, Math.max(-1, value));
    return Math.min(MAX_GAIN, Math.max(0, value));
}

export function isMixerMastersModel(value: unknown): value is MixerMastersModel {
    if (typeof value !== 'object' || value === null) return false;
    return MIXER_MASTERS_FIELDS.every((field) => typeof (value as any)[field] === 'number' && isFinite((value as any)[field]));
}
