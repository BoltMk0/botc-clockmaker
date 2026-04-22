import type { Resource } from "../common/types";
import { deleteResource, findResourceByName, encodeResourceId, saveResource, listResources } from "./resources";

function clock_id_to_resource_name(clockid: string): string {
    return `${clockid}`;
}

function resource_name_to_clock_id(resourceName: string): string | null {
    const match = resourceName.match(/^clock-(.+)-config$/);
    if(match) return match[1];
    return null;
}

function clock_id_to_resource_id(clockid: string, mimeType: string): string {
    return encodeResourceId('clockconfig', clock_id_to_resource_name(clockid), mimeType);
}

export function listClockConfigResources(): (Resource & {clockid: string})[] {
    const configs = listResources('clockconfig');
    const result: (Resource & {clockid: string})[] = [];
    for(const config of configs){
        const clockid = resource_name_to_clock_id(config.name);
        if(clockid) result.push({...config, clockid});
    }
    return result;
}

export function getClockConfigResource(clockid: string): Resource | null {
    const resource = findResourceByName(clock_id_to_resource_name(clockid), 'charactertokenimage');
    if(resource == null) return null;
    return resource;
}

export function setClockConfigResource(clockid: string, data: Buffer, mimeType: string) {
    const resourceId = clock_id_to_resource_id(clockid, mimeType);
    if(resourceId == null) throw new Error(`Failed to generate resource ID for clock ${clockid}`);
    saveResource(resourceId, data);
}

export function deleteClockConfigResource(clockid: string): boolean {
    const resource = findResourceByName(clock_id_to_resource_name(clockid), 'charactertokenimage');
    if(resource == null) return false;
    deleteResource(resource);
    return true;
}

