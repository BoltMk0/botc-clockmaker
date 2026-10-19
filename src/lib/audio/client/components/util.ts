
/** The bottom of the mixer's dB faders. */
export const FADER_MIN_DB = -36;
/** The top of the mixer's dB faders. */
export const FADER_MAX_DB = 12;

export function formatGain(value: number): string {
    return Math.log10(value) * 20 >= -60 ? (Math.log10(value) * 20).toFixed(1) + ' dB' : '-inf dB';
}

/** The front/rear balance: how far the other pair is turned down, or "F=R" with both at full level. */
export function formatFrontRear(value: number): string {
    if (value < -0.01) return `F ${(-value * 100).toFixed(0)}%`;
    else if (value > 0.01) return `R ${(value * 100).toFixed(0)}%`;
    else return 'F=R';
}

export function formatPan(value: number): string {
    if (value < -0.01) return `L ${(-value * 100).toFixed(0)}%`;
    else if (value > 0.01) return `R ${(value * 100).toFixed(0)}%`;
    else return 'C';
}

