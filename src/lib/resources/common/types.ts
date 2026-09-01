
export type ResourceType = "sfx" | "music" | "grimoirestate" | "charactertokenimage" | 'ambience' | 'clockconfig' | 'appconfig' | 'rules-slide' | 'feedback';
export const ALL_RESOURCE_TYPES: ResourceType[] = ['sfx', 'music', 'grimoirestate', 'charactertokenimage', 'ambience', 'clockconfig', 'appconfig', 'rules-slide', 'feedback'] as const;

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
        case "music":
        case "ambience":
            return "audio/*";
        case "grimoirestate":
        case "clockconfig":
        case 'appconfig':
            return "application/json";
        case "charactertokenimage":
        case 'rules-slide':
            return "image/*";
        case 'feedback':
            return 'plain/text';
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
        case 'rules-slide':
            return [".png", ".jpg", ".jpeg", ".webp", ".gif"];
        case 'appconfig':
            return ['.json'];
        case 'feedback':
            return ['.txt'];
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
