// Whites: the colour temperature nearest a colour, and the colour a colour temperature shows as. Shared by the page and
// the server (which bundles it), so the page shows the white the lights are sent.

/** The warmest and coolest whites most bulbs do, in mireds (about 2000K to 6500K). */
export const WARMEST = 500;
export const COOLEST = 153;

/** The white a black body glows at `mireds`, as CIE xy (Kim et al.'s fit to the Planckian locus). */
function planckXy(mireds) {
    const k = 1_000_000 / mireds;
    const x = k <= 4000
        ? -0.2661239e9 / k ** 3 - 0.2343589e6 / k ** 2 + 0.8776956e3 / k + 0.179910
        : -3.0258469e9 / k ** 3 + 2.1070379e6 / k ** 2 + 0.2226347e3 / k + 0.240390;
    const y = k <= 2222 ? -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683
        : k <= 4000 ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483;
    return { x, y };
}

/** CIE 1960 uv, where distances from the Planckian locus are measured. */
function xyToUv({ x, y }) {
    const d = -2 * x + 12 * y + 3;
    return { u: 4 * x / d, v: 6 * y / d };
}

const toLinear = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const LOCUS = [];
for (let mireds = COOLEST; mireds <= WARMEST; mireds++) LOCUS.push({ mireds, ...xyToUv(planckXy(mireds)) });

/** The colour temperature (in mireds) nearest a colour like #ffaa00: blues go to the coolest white, oranges warm. */
export function hexToMireds(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = toLinear((n >> 16) & 255), g = toLinear((n >> 8) & 255), b = toLinear(n & 255);
    const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
    const d = X + 15 * Y + 3 * Z;
    // Black has no hue; it's dimmed by its brightness anyway
    if (d === 0) return WARMEST;
    const u = 4 * X / d, v = 6 * Y / d;
    let best = LOCUS[0];
    for (const point of LOCUS) {
        if ((point.u - u) ** 2 + (point.v - v) ** 2 < (best.u - u) ** 2 + (best.v - v) ** 2) best = point;
    }
    return best.mireds;
}

/** The colour a white of `mireds` shows as, at full brightness, like #ffaa00. */
export function miredsToHex(mireds) {
    const { x, y } = planckXy(mireds);
    const X = x / y, Z = (1 - x - y) / y;
    const rgb = [
        3.2406 * X - 1.5372 - 0.4986 * Z,
        -0.9689 * X + 1.8758 + 0.0415 * Z,
        0.0557 * X - 0.2040 + 1.0570 * Z
    ].map(c => Math.max(c, 0));
    const max = Math.max(...rgb);
    return '#' + rgb.map(c => Math.round(fromLinear(c / max)).toString(16).padStart(2, '0')).join('');
}
