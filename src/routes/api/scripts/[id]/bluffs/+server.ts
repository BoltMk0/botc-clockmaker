import { getScriptBluffs, setScriptBluffs } from '$lib/server/database/script_bluffs';
import { json } from '@sveltejs/kit';

export async function GET({params}){
    const scriptId = parseInt(params.id, 10);
    if (isNaN(scriptId)){
        return new Response('Invalid script id', { status: 400 });
    }
    try {
        const bluffs = await getScriptBluffs(scriptId);
        return json(bluffs);
    } catch (error) {
        console.error(`Error fetching bluffs for script id ${scriptId}:`, error);
        return json({ error: 'Failed to fetch bluffs' }, { status: 500 });
    }
}

export async function POST({request, params}){
    const scriptId = parseInt(params.id, 10);
    if (isNaN(scriptId)){
        return new Response('Invalid script id', { status: 400 });
    }
    try {
        const { characterIds } = await request.json();
        if (!Array.isArray(characterIds) || !characterIds.every(id => typeof id === 'number')) {
            return new Response('Invalid characterIds format', { status: 400 });
        }
        await setScriptBluffs(scriptId, characterIds);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error setting bluffs for script id ${scriptId}:`, error);
        return json({ error: 'Failed to set bluffs' }, { status: 500 });
    }
}

export async function DELETE({params}){
    const scriptId = parseInt(params.id, 10);
    if (isNaN(scriptId)){
        return new Response('Invalid script id', { status: 400 });
    }
    try {
        await setScriptBluffs(scriptId, []);
        return new Response(null, { status: 204 });
    } catch (error) {
        console.error(`Error clearing bluffs for script id ${scriptId}:`, error);
        return json({ error: 'Failed to clear bluffs' }, { status: 500 });
    }
}
