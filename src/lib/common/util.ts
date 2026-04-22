import type { CommsConnectionStatus } from "$lib/client/model";

const sky_color_points = [
    { progress: 0, r: 140, g: 169, b: 255 },   // Dawn
    { progress: 0.6, r: 170, g: 196, b: 245 },    // Morning
    { progress: 0.8, r: 245, g: 240, b: 222 },  // Afternoon
    { progress: 0.9, r: 255, g: 230, b: 198 },     // Sunset
    { progress: 0.9999, r: 255, g: 200, b: 150 },     // Sunset Pink
    { progress: 1.0, r: 90, g: 90, b: 100 },     // midnight blue
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

export function formatTime(seconds: number): string {
    seconds = Math.round(seconds);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds - mins * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function commsStatusToColor(status: CommsConnectionStatus): string {
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