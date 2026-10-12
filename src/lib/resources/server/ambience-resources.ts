import type { AmbienceResource } from "$lib/common/ambience";
import { prettifyResourceName } from "$lib/resources/common/util";
import { listResources } from "$lib/resources/server/resources";
import { getAudioAssetMetadata } from "./audioAssetMetadata";


export function listAmbienceResources(): AmbienceResource[] {
    return listResources('ambience').map(r => ({ ...r, title: getAudioAssetMetadata(r.id)?.title || prettifyResourceName(r.name) }));
}
