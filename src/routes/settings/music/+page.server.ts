import type { Actions } from './$types';
import { getMusicLibrary } from '$lib/resources/server/musicLibrary';
import { getMusicPresets } from '$lib/resources/server/musicPresets';
import { serviceSettingsStatus } from '$lib/resources/server/serviceSettings';
import { serviceSettingsActions } from '$lib/resources/server/serviceSettingsActions';

export async function load(){
    return {
        library: getMusicLibrary(),
        musicPresets: getMusicPresets(),
        // For the Spotify app's credentials. Only whether the secret is set reaches the page, never its value
        services: serviceSettingsStatus()
    };
}

export const actions: Actions = serviceSettingsActions;
