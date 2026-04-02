
export type ResourceType = "sfx" | "music";

export type Resource = {
    id: string;
    name: string;
    type: ResourceType;
    mimetype: string;
}

export function resourceTimeToMimeType(resourceType: ResourceType): string {
    switch (resourceType) {
        case "sfx":
            return "audio/*";
        case "music":
            return "audio/*";
    }
}

export function resourceTimeToAcceptedExtensions(resourceType: ResourceType): string[] {
    switch (resourceType) {
        case "sfx":
        case "music":
            return [".wav", ".mp3"];
    }   
}

export const ALL_RESOURCE_TYPES = ["sfx", "music"] as const;
export function isValidResourceType(type: string): type is ResourceType {
    return ALL_RESOURCE_TYPES.includes(type as any);
}


