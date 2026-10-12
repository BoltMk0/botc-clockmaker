
/** The bottom of the mixer's dB faders. */
export const FADER_MIN_DB = -36;
/** The top of the mixer's dB faders. */
export const FADER_MAX_DB = 12;

export function formatGain(value: number): string {
    return Math.log10(value) * 20 >= -60 ? (Math.log10(value) * 20).toFixed(1) + ' dB' : '-inf dB';
}

export function formatPan(value: number): string {
    if (value < -0.01) return `L ${(-value * 100).toFixed(0)}%`;
    else if (value > 0.01) return `R ${(value * 100).toFixed(0)}%`;
    else return 'C';
}

