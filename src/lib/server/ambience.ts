import type { AmbienceResourceType } from "$lib/common/ambience";
import { basename } from "node:path";
import { getLocalResource, listLocalResources } from "./localfiles";
import { getExtensionForMimeType, getMimeTypeForFilename } from "$lib/common/util";


export type AmbienceResourceTypeServer = AmbienceResourceType & {
    local_filepath: string;
    mime_type: string;
}


function filepathToResourceType(filepath: string, mimeType: string): AmbienceResourceTypeServer {
    let id = basename(filepath);
    const ext = getExtensionForMimeType(mimeType);
    id = id.endsWith(ext) ? id.slice(0, -ext.length) : id; // remove extension for display name

    let name = id;
    name = name.replaceAll('_', ' '); // replace underscores with spaces for better readability
    name = name.replaceAll('.', ' '); // replace dots with spaces for better readability
    // remove numberic prefixes (e.g. "01 - rain.mp3" -> "rain")
    name = name.replace(/^\d+\s*[-_\.]?\s*/, '');
    return {
        id: id,
        name: name,
        url: `/resources/ambience/${encodeURIComponent(id)}`,
        local_filepath: filepath,
        mime_type: mimeType
    }
}

export function listAmbienceResources(): AmbienceResourceTypeServer[] {
    const resources = listLocalResources('ambience', {mimeType: 'audio/*'});
    return resources.map(r => filepathToResourceType(r.filepath, r.mimeType));  
}

export function getAmbienceResourceById(id: string): AmbienceResourceTypeServer | null {
    const resource = getLocalResource(`ambience/${id}`, {checkExists: false, mimeType: 'audio/*'});
    return filepathToResourceType(resource, getMimeTypeForFilename(resource));
}