import { json } from '@sveltejs/kit';
import { addCharacterToScript, removeCharacterFromScript, getScriptById } from '$lib/resources/server/scripts';
import { getCharacterById } from '$lib/resources/server/characters';

export async function POST({ params }) {
    const scriptId = params.id;
    const characterId = params.characterId;

    const script = getScriptById(scriptId);
    const character = getCharacterById(characterId);
    if (!script)    return json({ error: 'Script not found' },    { status: 404 });
    if (!character) return json({ error: 'Character not found' }, { status: 404 });

    addCharacterToScript(scriptId, characterId);
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const removed = removeCharacterFromScript(params.id, params.characterId);
    if (!removed) return json({ error: 'Link not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
