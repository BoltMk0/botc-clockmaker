import { json } from '@sveltejs/kit';
import { addCharacterToScript, removeCharacterFromScript, getScriptById } from '$lib/database/server/scripts';
import { getCharacterById } from '$lib/database/server/characters';

export async function POST({ params }) {
    const scriptId = Number(params.id);
    const characterId = Number(params.characterId);
    if (!Number.isInteger(scriptId) || !Number.isInteger(characterId)) {
        return json({ error: 'Invalid id' }, { status: 400 });
    }

    const [script, character] = await Promise.all([
        getScriptById(scriptId),
        getCharacterById(characterId)
    ]);
    if (!script)    return json({ error: 'Script not found' },    { status: 404 });
    if (!character) return json({ error: 'Character not found' }, { status: 404 });

    await addCharacterToScript(scriptId, characterId);
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const scriptId = Number(params.id);
    const characterId = Number(params.characterId);
    if (!Number.isInteger(scriptId) || !Number.isInteger(characterId)) {
        return json({ error: 'Invalid id' }, { status: 400 });
    }

    const removed = await removeCharacterFromScript(scriptId, characterId);
    if (!removed) return json({ error: 'Link not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
