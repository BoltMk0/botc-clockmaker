import type { Resource } from "../common/types";
import { deleteResource, findResourceByName, encodeResourceId, saveResource } from "./resources";

function character_id_to_resource_name(characterid: string): string {
    return `character-${characterid}-img`;
}

function character_id_to_resource_id(characterid: string, mimeType: string): string {
    return encodeResourceId('charactertokenimage', character_id_to_resource_name(characterid), mimeType);
}

export function getCharacterImageResource(characterid: string): Resource | null {
    const resource = findResourceByName(character_id_to_resource_name(characterid), 'charactertokenimage');
    if(resource == null) return null;
    return resource;
}

export function setCharacterImageResource(characterid: string, data: Buffer, mimeType: string) {
    const resourceId = character_id_to_resource_id(characterid, mimeType);
    if(resourceId == null) throw new Error(`Failed to generate resource ID for character ${characterid}`);
    saveResource(resourceId, data);
}

export function deleteCharacterImageResource(characterid: string): boolean {
    const resource = findResourceByName(character_id_to_resource_name(characterid), 'charactertokenimage');
    if(resource == null) return false;
    deleteResource(resource);
    return true;
}

