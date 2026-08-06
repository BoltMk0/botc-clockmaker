
const sky_color_points = [
    { progress: 0, r: 140, g: 170, b: 210 },   // Dawn
    { progress: 0.4, r: 140, g: 180, b: 220 },    // Morning
    { progress: 0.8, r: 120, g: 169, b: 230 },  // Afternoon
    { progress: 0.88, r: 160, g: 200, b: 210 },     // Sunset
    { progress: 0.9999, r: 180, g: 150, b: 130 },     // Sunset Pink
    { progress: 1.0, r: 65, g: 62, b: 60 },     // midnight blue
];

export function getSkyColor(progress: number, opacity: number = 1, gamma: number = 1, brightness: number = 1): string {
    // Find the two points to interpolate between
    let lowerPoint = sky_color_points[0];
    let upperPoint = sky_color_points[sky_color_points.length - 1];

    for (let i = 0; i < sky_color_points.length - 1; i++) {
        if (progress >= sky_color_points[i].progress && progress <= sky_color_points[i + 1].progress) {
            lowerPoint = sky_color_points[i];
            upperPoint = sky_color_points[i + 1];
            break;
        }
    }

    // Calculate interpolation factor
    const range = upperPoint.progress - lowerPoint.progress;
    const factor = (progress - lowerPoint.progress) / range;

    // Interpolate RGB values
    const r = Math.round(lowerPoint.r + factor * (upperPoint.r - lowerPoint.r));
    const g = Math.round(lowerPoint.g + factor * (upperPoint.g - lowerPoint.g));
    const b = Math.round(lowerPoint.b + factor * (upperPoint.b - lowerPoint.b));

    // Compensate for gamma
    const r_gamma = Math.round(255 * Math.pow(r / 255, 1 / gamma));
    const g_gamma = Math.round(255 * Math.pow(g / 255, 1 / gamma));
    const b_gamma = Math.round(255 * Math.pow(b / 255, 1 / gamma));

    return `rgba(${r_gamma * brightness}, ${g_gamma * brightness}, ${b_gamma * brightness}, ${opacity})`;
}

function clamp(x: number, lo: number = 0, hi: number = 255): number {
    return Math.min(hi, Math.max(lo, x));
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let [r1, g1, b1] = [0, 0, 0];
    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

// Parses plain #hex / rgb(a)() / hsl(a)() colors. Does not support CSS relative
// color syntax (`hsl(from ...)`) since that requires a live CSS engine to resolve.
export function parseCssColor(color: string): { r: number; g: number; b: number } {
    const value = color.trim();

    const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map(c => c + c).join('');
        }
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }

    const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgbMatch) {
        return {
            r: parseFloat(rgbMatch[1]),
            g: parseFloat(rgbMatch[2]),
            b: parseFloat(rgbMatch[3])
        };
    }

    const hslMatch = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
    if (hslMatch) {
        return hslToRgb(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]) / 100, parseFloat(hslMatch[3]) / 100);
    }

    throw new Error(`Unsupported color format for ambient tinting: ${color}`);
}

function srgbToLinear(c: number): number {
    const v = clamp(c) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
    v = clamp(v, 0, 1);
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(c * 255);
}

/**
 * Tints a base (surface) color by an ambient/illuminant color, e.g. a sky color.
 * Multiplies in linear light (not gamma-encoded sRGB) so mid-tones don't get
 * crushed the way a plain `color-mix`/alpha-overlay does, and normalizes the
 * ambient color against its own brightest channel so a bright ambient color
 * shifts hue without just darkening everything.
 *
 * `amount` blends between the untinted base (0) and the fully tinted result (1).
 */
export function tintByAmbient(baseColor: string, ambientColor: string, amount: number = 1): string {
    const base = parseCssColor(baseColor);
    const ambient = parseCssColor(ambientColor);

    const baseLinear = [base.r, base.g, base.b].map(srgbToLinear);
    const ambientLinear = [ambient.r, ambient.g, ambient.b].map(srgbToLinear);
    const ambientMax = Math.max(...ambientLinear, 1e-6);

    const tinted = baseLinear
        .map((c, i) => c * (ambientLinear[i] / ambientMax))
        .map(linearToSrgb);

    const baseArr = [base.r, base.g, base.b];
    const [r, g, b] = baseArr.map((c, i) => Math.round(clamp(c * (1 - amount) + tinted[i] * amount)));

    return `rgb(${r}, ${g}, ${b})`;
}

export function formatTime(seconds: number): string {
    seconds = Math.round(seconds);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds - mins * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function commsStatusToColor(status: string): string {
    switch (status) {
        case 'connected':
            return 'green';
        case 'connecting':
            return 'orange';
        case 'disconnected':
            return 'red';
        default:
            return 'black';
    }
}

const mimeTypeMap: {[key: string]: string} = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.json': 'application/json',
    '.txt': 'text/plain'
};

export function getMimeTypeForExtension(ext: string): string {
    return mimeTypeMap[ext.toLowerCase()] || 'application/octet-stream';
}

export function getExtensionForMimeType(mimeType: string): string {
    for (const ext in mimeTypeMap) {
        if (mimeTypeMap[ext] === mimeType) {
            return ext;
        }
    }
    return '';
}

export function fileFitsMimeType(filename: string, mimeType: string): boolean {
    const ext = filename.substring(filename.lastIndexOf('.'));
    const fileMimeType = getMimeTypeForExtension(ext);
    
    // Support wildcard mime types like "audio/*"
    if(mimeType.endsWith('/*')){
        const typePrefix = mimeType.split('/')[0];
        return fileMimeType.startsWith(typePrefix + '/');
    }
    return fileMimeType === mimeType;
}

export function getMimeTypeForFilename(filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.'));
    return getMimeTypeForExtension(ext);
}

export function getPlayerCount(numPlayers: number){
    let townsfolk: number;
    let outsiders: number;
    let minions: number;
    let demons: number = 1;
    if(numPlayers < 5){
        townsfolk = numPlayers-1;
        minions = 0;
        outsiders = 0;
    }
    else if(numPlayers < 7){
        townsfolk = 3;
        minions = 1;
        outsiders = numPlayers-5;
    } else if (numPlayers > 15) {
        townsfolk = 9;
        outsiders = 2;
        minions = 3;
    }
    else {
        townsfolk = 5 + 2*Math.floor((numPlayers-7)/3);
        outsiders = (numPlayers-7)%3;
        minions = 1 + Math.floor((numPlayers-7)/3);
    }

    return {townsfolk, outsiders, minions, demons};
}

export function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    if(seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function linearToDb(linear: number){
    return 20 * Math.log10(linear);
}

export function dbToLinear(db: number){
    return Math.pow(10, db / 20);
}