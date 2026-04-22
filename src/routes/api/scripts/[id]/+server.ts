import { json } from '@sveltejs/kit';
import { getScriptWithCharacters, updateScript, deleteScript } from '$lib/database/server/scripts';

export async function GET({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const script = await getScriptWithCharacters(id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });
    return json(script);
}

export async function PATCH({ params, request }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, hue } = body;
    const script = await updateScript(id, { name, hue });
    if (!script) return json({ error: 'Script not found' }, { status: 404 });
    return json(script);
}

export async function DELETE({ params }) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid id' }, { status: 400 });

    const deleted = await deleteScript(id);
    if (!deleted) return json({ error: 'Script not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
