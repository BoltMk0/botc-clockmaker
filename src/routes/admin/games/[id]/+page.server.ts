import { getFullGame, setGameSetupCharacters } from '$lib/resources/server/games';
import { fail } from '@sveltejs/kit';

export async function load({params}){
    const id = params.id;

    try {
        const game = getFullGame(id);
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
        const id = params.id;

        try {
            const body = await request.formData();
            if(!body) return { success: false, error: 'Request body is required' };

            const characterIdsRaw = body.get('characterIds')?.toString() || '';
            const characterIds = characterIdsRaw === '' ? [] : characterIdsRaw.split(',').filter(s => s !== '');
            const bluffIdsRaw = body.get('bluffIds')?.toString() || '';
            const bluffIds = bluffIdsRaw === '' ? [] : bluffIdsRaw.split(',').filter(s => s !== '');

            console.log(`Saving characters for game ${id}:`, characterIds, bluffIds);

            setGameSetupCharacters(id, characterIds, bluffIds);

            return { success: true };
        }       catch (e) {
            console.error(`Failed to save characters for game with id "${id}"`, e);
            return fail(500, { success: false, error: 'Failed to save characters' });
        }
    }
}