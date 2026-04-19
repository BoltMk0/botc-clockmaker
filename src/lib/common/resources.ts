
export type ResourceType = "sfx" | "music" | "grimoirestate";

export type Resource = {
    id: string;
    name: string;
    type: ResourceType;
    mimetype: string;
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
            return "application/json";
    }
}

export function getAcceptedExtensionsForResourceType(resourceType: ResourceType): string[] {
    switch (resourceType) {
        case "sfx":
        case "music":
            return [".wav", ".mp3"];
        case "grimoirestate":
            return [".json"];
    }   
}

export const ALL_RESOURCE_TYPES = ["sfx", "music", "grimoirestate"] as const;

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
