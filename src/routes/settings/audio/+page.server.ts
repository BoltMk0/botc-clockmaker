import type { Resource } from '$lib/resources/common/types';
import { listAmbienceResources } from '$lib/resources/server/ambience-resources';
import { listClockSfxPresets } from '$lib/resources/server/clock-sfx-presets';
import { getResourceStats, listResources } from '$lib/resources/server/resources';
import { getAudioAssetMetadata } from '$lib/resources/server/audioAssetMetadata';
import { emptyAudioAssetMetadata } from '$lib/audio/common/audioAssetMetadata';
import { getMusicLibrary } from '$lib/resources/server/musicLibrary';

/** Adds each asset's file size (bytes), for the asset lists. */
function withSizes(resources: Resource[]) {
    return resources.map(r => ({ ...r, size: getResourceStats(r)?.size ?? null }));
}

export async function load(){
    const tracks = getMusicLibrary().tracks;
    return {
        /** How far the loudness worker has got through the music library. */
        musicLoudness: { measured: tracks.filter(t => t.loudness !== undefined).length, total: tracks.length },
        clockSfxPresets: listClockSfxPresets(),
        ambienceResources: withSizes(listAmbienceResources()).map(r => ({ ...r, metadata: getAudioAssetMetadata(r.id) ?? emptyAudioAssetMetadata() })),
        stingResources: withSizes(listResources('sting'))
    };
}
