import { error } from '@sveltejs/kit';
import { getCharacterById } from '$lib/resources/server/characters';

export async function load({ params }) {
    const character = getCharacterById(params.characterId);
    if (!character) throw error(404, 'Character not found');
    return { clockid: params.clockid, character };
}
