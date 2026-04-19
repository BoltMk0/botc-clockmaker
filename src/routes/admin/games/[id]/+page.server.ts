import { getGameSetupById, getGameSetupWithCharacters } from '$lib/server/database/games';

export async function load({params}){
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
        console.warn(`Invalid game id "${params.id}" - not an integer`);
        return { game: null, error: 'Invalid game id' };
    }

    try {
        const game = await getGameSetupWithCharacters(id);
        if (!game) {
            console.warn(`Game with id "${id}" not found`);
            return { game: null, error: 'Game not found' };
        }
        return { game };
    } catch (e) {
        console.error(`Failed to load game with id "${id}"`, e);
        return { game: null, error: 'Failed to load game' };
    }
}