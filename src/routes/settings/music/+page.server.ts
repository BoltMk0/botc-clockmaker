import { getMusicLibrary } from '$lib/resources/server/musicLibrary';
import { getMusicPresets } from '$lib/resources/server/musicPresets';

export async function load(){
    return { library: getMusicLibrary(), musicPresets: getMusicPresets() };
}
