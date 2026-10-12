import { error } from '@sveltejs/kit';
import { MusicLibraryError } from '$lib/resources/server/musicLibrary';

/** Runs a library change, turning a MusicLibraryError into the matching HTTP error. */
export async function libraryChange<T>(change: () => T | Promise<T>): Promise<T> {
    try {
        return await change();
    } catch(e) {
        if(e instanceof MusicLibraryError) error(e.status, { message: e.message });
        throw e;
    }
}
