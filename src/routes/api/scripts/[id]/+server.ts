import { json } from '@sveltejs/kit';
import { getScriptWithCharacters, updateScript, deleteScript } from '$lib/resources/server/scripts';

export async function GET({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });
    return json(script);
}

export async function PATCH({ params, request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, hue } = body;
    const script = updateScript(params.id, { name, hue });
    if (!script) return json({ error: 'Script not found' }, { status: 404 });
    return json(script);
}

export async function DELETE({ params }) {
    const deleted = deleteScript(params.id);
    if (!deleted) return json({ error: 'Script not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
