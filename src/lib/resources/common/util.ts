import type { ResourceType } from "./types";

const mimeTypeMap: {[key: string]: string} = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
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

export function slugify(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


/** The stored form of a typed resource name (for audio asset libraries): lowercase, spaces as underscores. */
export function resourceNameSlug(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
}

export function prettifyResourceType(type: ResourceType): string {
    switch(type){
        case "sfx": return "SFX";
        case "music": return "Music";
        case "grimoirestate": return "Grimoire State";
        case "charactertokenimage": return "Character Token Image";
        case "ambience": return "Ambience";
        case "sting": return "Audio Stings";
        case "clockconfig": return "Clock Config";
        case 'appconfig': return "App Config";
        case 'rules-slide': return "Rules Slides"
        default: return type;
    }
}
