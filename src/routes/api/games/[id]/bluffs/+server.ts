import { clearGameBluffs, getGameBluffs, setGameBluffs } from '$lib/resources/server/games.js';
import { json } from '@sveltejs/kit';

export async function GET({params}){
    const gameId = params.id;
    try {
        const bluffs = getGameBluffs(gameId);
        return json(bluffs);
    } catch (error) {
        console.error(`Error fetching bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to fetch bluffs' }, { status: 500 });
    }
}

export async function POST({request, params}){
    const gameId = params.id;
    try {
        const { characterIds } = await request.json();
        if (!Array.isArray(characterIds) || !characterIds.every(id => typeof id === 'string')) {
            return new Response('Invalid characterIds format', { status: 400 });
        }
        setGameBluffs(gameId, characterIds);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error setting bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to set bluffs' }, { status: 500 });
    }
}

export async function DELETE({params}){
    const gameId = params.id;
    try {
        clearGameBluffs(gameId);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error clearing bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to clear bluffs' }, { status: 500 });
    }
}
