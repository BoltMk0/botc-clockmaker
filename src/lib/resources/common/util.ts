import type { ResourceType } from "./types";

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

export function prettifyResourceName(name: string): string {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}


export function prettifyResourceType(type: ResourceType): string {
    switch(type){
        case "sfx": return "SFX";
        case "music": return "Music";
        case "grimoirestate": return "Grimoire State";
        case "charactertokenimage": return "Character Token Image";
        case "ambience": return "Ambience";
        case "clockconfig": return "Clock Config";
        case 'appconfig': return "App Config";
        case 'rules-slide': return "Rules Slides"
        default: return type;
    }
}
