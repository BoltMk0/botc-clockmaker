import type { Resource } from "../common/types";
import { deleteResource, findResourceByName, encodeResourceId, saveResource } from "./resources";

function clock_id_to_resource_names(clockid: string): {final: string, reminder: string} {
    return { final: `clock-${clockid}-sfx-final`, reminder: `clock-${clockid}-sfx-reminder` };
}

function clock_id_to_final_resource_id(clockid: string, mimeType: string): string {
    return encodeResourceId('sfx', clock_id_to_resource_names(clockid).final, mimeType);
}

function clock_id_to_reminder_resource_id(clockid: string, mimeType: string): string {
    return encodeResourceId('sfx', clock_id_to_resource_names(clockid).reminder, mimeType);
}

export function getFinalClockSoundResource(clockid: string): Resource | null {
    const resource = findResourceByName(clock_id_to_resource_names(clockid).final, 'sfx');
    if(resource == null) return null;
    return resource;
}

export function getReminderClockSoundResource(clockid: string): Resource | null {
    const resource = findResourceByName(clock_id_to_resource_names(clockid).reminder, 'sfx');
    if(resource == null) return null;
    return resource;
}

export function setFinalClockSoundResource(clockid: string, data: Buffer, mimeType: string) {
    const resourceId = clock_id_to_final_resource_id(clockid, mimeType);
    if(resourceId == null) throw new Error(`Failed to generate resource ID for clock ${clockid}`);
    saveResource(resourceId, data);
}

export function setReminderClockSoundResource(clockid: string, data: Buffer, mimeType: string) {
    const resourceId = clock_id_to_reminder_resource_id(clockid, mimeType);
    if(resourceId == null) throw new Error(`Failed to generate resource ID for clock ${clockid}`);
    saveResource(resourceId, data);
}

export function deleteReminderClockSoundResource(clockid: string): boolean {
    const resource = findResourceByName(clock_id_to_resource_names(clockid).reminder, 'sfx');
    if(resource == null) return false;
    deleteResource(resource);
    return true;
}

