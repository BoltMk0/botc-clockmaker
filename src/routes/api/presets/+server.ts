import { json } from '@sveltejs/kit';
import { createPreset, listPresets, listPresetsForScript } from '$lib/resources/server/presets';

export async function GET({ url }) {
    const scriptId = url.searchParams.get('script_id');
    if (scriptId) {
        return json(listPresetsForScript(scriptId));
    }
    return json(listPresets());
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { script_id, name } = body;
    if (!script_id) {
        return json({ error: 'script_id is required' }, { status: 400 });
    }
    if (!name) {
        return json({ error: 'name is required' }, { status: 400 });
    }

    const preset = createPreset({ script_id, name, character_ids: [], bluff_ids: [] });
    return json(preset, { status: 201 });
}
