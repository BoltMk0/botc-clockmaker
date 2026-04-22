import { json } from '@sveltejs/kit';
import { listScripts, listScriptsWithCharacters, createScript } from '$lib/database/server/scripts';

export async function GET({ url }) {
    const withCharacters = url.searchParams.get('characters') === 'true';
    if (withCharacters) {
        return json(await listScriptsWithCharacters());
    }
    return json(await listScripts());
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, hue } = body;
    if (!name || !hue) {
        return json({ error: 'name and hue are required' }, { status: 400 });
    }

    const script = await createScript({ name, hue });
    return json(script, { status: 201 });
}
