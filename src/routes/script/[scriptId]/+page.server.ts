import { error } from '@sveltejs/kit';
import { getScriptWithCharacters } from '$lib/resources/server/scripts';

export async function load({ params, url }) {
    const script = getScriptWithCharacters(params.scriptId);
    if (!script) error(404, 'Script not found');

    // Only same-site paths, so a shared link can't send people off to another site.
    const backUrlParam = url.searchParams.get('backUrl');
    // (Browsers read "//x" and "/\x" as links to the site x.)
    const backUrl = backUrlParam && /^\/(?![/\\])/.test(backUrlParam) ? backUrlParam : null;

    return { script, backUrl };
}
