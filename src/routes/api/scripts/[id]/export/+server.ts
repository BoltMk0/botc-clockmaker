import { json } from '@sveltejs/kit';
import { getScriptWithCharacters } from '$lib/resources/server/scripts';
import { scriptToSchema } from '$lib/resources/common/scriptSchema';

// The script as a download, in the official custom script format.
export async function GET({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) return json({ error: 'Script not found' }, { status: 404 });
    return json(scriptToSchema(script), {
        headers: { 'Content-Disposition': `attachment; filename="${script.id}.json"` }
    });
}
