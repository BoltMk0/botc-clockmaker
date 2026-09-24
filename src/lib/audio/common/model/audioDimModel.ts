/** Shared "dim" state: while dimmed, everything that plays is turned down by amountDb. */
export type AudioDimModel = {
    dimmed: boolean;
    /** How far to drop the volume while dimmed, in dB (positive number). */
    amountDb: number;
};

export const DEFAULT_DIM_AMOUNT_DB = 6;
export const MIN_DIM_AMOUNT_DB = 3;
export const MAX_DIM_AMOUNT_DB = 18;

export function clampDimAmount(amountDb: number): number {
    return Math.min(MAX_DIM_AMOUNT_DB, Math.max(MIN_DIM_AMOUNT_DB, amountDb));
}

/** The linear gain multiplier the model calls for (1 when not dimmed). */
export function dimGain(model: AudioDimModel): number {
    return model.dimmed ? Math.pow(10, -model.amountDb / 20) : 1;
}
