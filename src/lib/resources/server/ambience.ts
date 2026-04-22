import type { Resource } from "$lib/resources/common/types";
import { listResources } from "$lib/resources/server/resources";


export function listAmbienceResources(): Resource[] {
    return listResources('ambience');
}

