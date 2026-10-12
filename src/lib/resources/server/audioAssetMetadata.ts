import { isAudioAssetMetadataEmpty, isAudioAssetMetadataMap, normaliseAudioAssetMetadata, type AudioAssetMetadata } from "$lib/audio/common/audioAssetMetadata";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

/** Every audio asset's metadata in one file, keyed by the asset's resource id. Assets with none have no entry. */
const AUDIO_ASSET_METADATA_MANAGER = new JSONSingletonResourceManager<Record<string, AudioAssetMetadata>>('audio_asset_metadata', isAudioAssetMetadataMap);

function all(): Record<string, AudioAssetMetadata> {
    return AUDIO_ASSET_METADATA_MANAGER.value ?? {};
}

export function getAudioAssetMetadata(id: string): AudioAssetMetadata | null {
    return all()[id] ?? null;
}

/** Saves the asset's metadata (trimmed); all-empty metadata removes its entry. */
export function setAudioAssetMetadata(id: string, metadata: AudioAssetMetadata) {
    const normalised = normaliseAudioAssetMetadata(metadata);
    const next = { ...all() };
    if (isAudioAssetMetadataEmpty(normalised)) {
        if (!(id in next)) return;
        delete next[id];
    } else {
        next[id] = normalised;
    }
    AUDIO_ASSET_METADATA_MANAGER.save(next);
}

/** Moves an asset's metadata to its new id after a rename, or drops it (newId null) when the asset is deleted. */
export function moveAudioAssetMetadata(oldId: string, newId: string | null) {
    const current = all();
    if (oldId === newId || !(oldId in current)) return;
    const next = { ...current };
    if (newId !== null) next[newId] = next[oldId];
    delete next[oldId];
    AUDIO_ASSET_METADATA_MANAGER.save(next);
}
