import { clearGameBluffs, getGameBluffs, setGameBluffs } from '$lib/database/server/games.js';
import { json } from '@sveltejs/kit';

export async function GET({params}){
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)){
        return new Response('Invalid game id', { status: 400 });
    }
    try {
        const bluffs = await getGameBluffs(gameId);
        return json(bluffs);
    } catch (error) {
        console.error(`Error fetching bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to fetch bluffs' }, { status: 500 });
    }
}

export async function POST({request, params}){
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)){
        return new Response('Invalid game id', { status: 400 });
    }
    try {
        const { characterIds } = await request.json();
        if (!Array.isArray(characterIds) || !characterIds.every(id => typeof id === 'number')) {
            return new Response('Invalid characterIds format', { status: 400 });
        }
        await setGameBluffs(gameId, characterIds);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error setting bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to set bluffs' }, { status: 500 });
    }
}

export async function DELETE({params}){
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)){
        return new Response('Invalid game id', { status: 400 });
    }
    try {
        await clearGameBluffs(gameId);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error clearing bluffs for game id ${gameId}:`, error);
        return json({ error: 'Failed to clear bluffs' }, { status: 500 });
    }
}
