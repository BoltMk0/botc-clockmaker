import { getFullGame, setGameSetupCharacters } from '$lib/database/server/games';
import { fail } from '@sveltejs/kit';

export async function load({params}){
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
        console.warn(`Invalid game id "${params.id}" - not an integer`);
        return { game: null, error: 'Invalid game id' };
    }

    try {
        const game = await getFullGame(id);
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

export const actions = {
    saveCharacters: async ({ request, params }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id)) {
            return { success: false, error: 'Invalid game id' };
        }

        try {
            const body = await request.formData();
            if(!body) return { success: false, error: 'Request body is required' };

            const characterIdsRaw = body.get('characterIds')?.toString() || '';
            const characterIds = characterIdsRaw === '' ? [] : characterIdsRaw.split(',').map(Number).filter(n => !isNaN(n));
            const bluffIdsRaw = body.get('bluffIds')?.toString() || '';
            const bluffIds = bluffIdsRaw === '' ? [] : bluffIdsRaw.split(',').map(Number).filter(n => !isNaN(n));

            if (!Array.isArray(characterIds) || !characterIds.every(Number.isInteger)) {
                return fail(400, { success: false, error: 'characterIds array of integers is required' });
            }

            if(!Array.isArray(bluffIds) || !bluffIds.every(Number.isInteger)) {
                return fail(400, { success: false, error: 'bluffIds array of integers is required' });
            }

            console.log(`Saving characters for game ${id}:`, characterIds, bluffIds);
            
            await setGameSetupCharacters(id, characterIds, bluffIds);

            return { success: true };
        }       catch (e) { 
            console.error(`Failed to save characters for game with id "${id}"`, e);
            return fail(500, { success: false, error: 'Failed to save characters' });
        }
    }
}