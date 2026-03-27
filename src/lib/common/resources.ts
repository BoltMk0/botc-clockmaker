
export type ResourceType = "image" | "audio" | "video" | "document" | "other";

export type Resource = {
    id: string;
    name: string;
    type: ResourceType;
    mimetype: string;
}


export function typeFromMimetype(mimetype: string): ResourceType {
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("audio/")) return "audio";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype === "application/pdf" || mimetype.startsWith("application/")) return "document";
    return "other";
}

export const ACCEPTED_RESOURCE_EXTENSIONS = [".wav", ".mp3"] as const;
export const ALL_RESOURCE_TYPES = ["image", "audio", "video", "document", "other"] as const;

