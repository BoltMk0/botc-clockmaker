import { isSpotifyPreset, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

function isSpotifyPresetList(data: unknown): data is SpotifyPreset[] {
    return Array.isArray(data) && data.every(isSpotifyPreset);
}

const SPOTIFY_PRESETS_MANAGER = new JSONSingletonResourceManager<SpotifyPreset[]>('spotify_presets', isSpotifyPresetList);

export function getSpotifyPresets(): SpotifyPreset[] {
    return SPOTIFY_PRESETS_MANAGER.value ?? [];
}

export function saveSpotifyPresets(presets: SpotifyPreset[]) {
    SPOTIFY_PRESETS_MANAGER.save(presets);
}
