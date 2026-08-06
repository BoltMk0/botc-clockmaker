
export type ResourceType = "sfx" | "music" | "grimoirestate" | "charactertokenimage" | 'ambience' | 'clockconfig' | 'appconfig';
export const ALL_RESOURCE_TYPES: ResourceType[] = ['sfx', 'music', 'grimoirestate', 'charactertokenimage', 'ambience', 'clockconfig', 'appconfig'] as const;

export function isResourceType(value: any): value is ResourceType {
    if(typeof value !== 'string') return false;
    if(!ALL_RESOURCE_TYPES.includes(value as any)) return false;
    return true;
}

export type Resource = {
    id: string;
    name: string;
    type: ResourceType;
    mimetype: string;
}

export function isResource(data: any): data is Resource {
    if(typeof data !== 'object') return false;
    if(typeof data.id !== 'string') return false;
    if(typeof data.name !== 'string') return false;
    if(!isResourceType(data.type)) return false;
    if(typeof data.mimetype !== 'string') return false;
    return true;
}

export type ReminderTokenResource = Resource & {
    type: "reminder-token";
    token_id: string|null;
    hue: string|null;
}

export function getAcceptedMimeTypeForResourceType(resourceType: ResourceType): string {
    switch (resourceType) {
        case "sfx":
            return "audio/*";
        case "music":
            return "audio/*";
        case "grimoirestate":
        case "clockconfig":
            return "application/json";
        case "charactertokenimage":
            return "image/*";
        case "ambience":
            return "audio/*";
        case 'appconfig':
            return 'application/json'

    }
}

export function getAcceptedExtensionsForResourceType(resourceType: ResourceType): string[] {
    switch (resourceType) {
        case "sfx":
        case "music":
        case "ambience":
            return [".wav", ".mp3"];
        case "grimoirestate":
        case "clockconfig":
            return [".json"];
        case "charactertokenimage":
            return [".png", ".jpg", ".jpeg", ".webp", ".gif"];
        case 'appconfig':
            return ['.json']
    }   
}

export function isValidResourceType(type: string): type is ResourceType {
    return ALL_RESOURCE_TYPES.includes(type as any);
}

export function isValidResource(resource: any): resource is Resource {
    const result = typeof resource === "object" &&
        typeof resource.id === "string" &&
        typeof resource.name === "string" &&
        isValidResourceType(resource.type) &&
        typeof resource.mimetype === "string";
    if(!result) return false;

    if(resource.type === "reminder-token"){
        return (typeof resource.token_id === "string" || resource.token_id === null) &&
            (typeof resource.hue === "string" || resource.hue === null);
    }

    return true;
}
