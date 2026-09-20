/** Shared "dim" state: while dimmed, everything that plays is turned down by amountDb. */
export type AudioDimModel = {
    dimmed: boolean;
    /** How far to drop the volume while dimmed, in dB (positive number). */
    amountDb: number;
};

export const DEFAULT_DIM_AMOUNT_DB = 12;
export const MAX_DIM_AMOUNT_DB = 60;

/** The linear gain multiplier the model calls for (1 when not dimmed). */
export function dimGain(model: AudioDimModel): number {
    return model.dimmed ? Math.pow(10, -model.amountDb / 20) : 1;
}
