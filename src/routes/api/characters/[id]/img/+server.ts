import { json } from '@sveltejs/kit';
import { statSync } from 'fs';
import { getCharacterById } from '$lib/resources/server/characters';
import { getCharacterImageResource, getCharacterImageForSize, setCharacterImageResource, deleteCharacterImageResource } from '$lib/resources/server/character-images';
import { getResourceData, getResourceFilePath } from '$lib/resources/server/resources';


const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Browsers reuse a fetched image for a few minutes without asking, then check back with its ETag (a cheap 304 when
// it's unchanged), showing the copy they have in the meantime. So a replaced image shows up everywhere within
// CACHE_MAX_AGE_SECONDS. `private`: the app is behind a login, so shared caches mustn't keep it.
const CACHE_MAX_AGE_SECONDS = 300;
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 86400;
const CACHE_CONTROL = `private, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`;

async function resolveCharacter(idParam: string) {
    const character = getCharacterById(idParam);
    if (!character) return { character: null, error: json({ error: 'Character not found' }, { status: 404 }) };
    return { character, error: null };
}

// `?size=N` asks for a scaled-down copy at least N px wide (see characterImageUrl); without it, the full-size image.
export async function GET({ params, url, request }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const size = Number(url.searchParams.get('size'));
    const res = size > 0
        ? await getCharacterImageForSize(character.id, size)
        : getCharacterImageResource(character.id);
    if (!res) return json({ error: 'No image found for this character' }, { status: 404 });

    // Which file (full size or a scaled copy) and which version of it: changes whenever the image is replaced.
    let stats;
    try {
        stats = statSync(getResourceFilePath(res));
    } catch {
        return json({ error: 'Failed to read image data' }, { status: 500 });
    }
    const etag = `"${res.id}-${stats.size.toString(36)}-${Math.floor(stats.mtimeMs).toString(36)}"`;
    const cacheHeaders = {
        'Cache-Control': CACHE_CONTROL,
        'ETag': etag,
        'Last-Modified': stats.mtime.toUTCString()
    };

    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch.split(',').some(tag => tag.trim().replace(/^W\//, '') === etag)) {
        return new Response(null, { status: 304, headers: cacheHeaders });
    }

    const data = getResourceData(res);
    if (!data) return json({ error: 'Failed to read image data' }, { status: 500 });

    return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': res.mimetype, ...cacheHeaders }
    });
}

export async function PUT({ params, request }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const contentType = request.headers.get('content-type') ?? '';
    const mimeType = contentType.split(';')[0].trim();

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return json(
            { error: `Unsupported image type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
            { status: 415 }
        );
    }

    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.byteLength === 0) return json({ error: 'Empty body' }, { status: 400 });

    try {
        await setCharacterImageResource(character.id, buffer, mimeType);
    } catch (err) {
        console.error(`Failed to save image for character ${character.id}:`, err);
        return json({ error: 'Could not read the uploaded image' }, { status: 400 });
    }
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const deleted = deleteCharacterImageResource(character.id);
    if (!deleted) return json({ error: 'No image found for this character' }, { status: 404 });
    return new Response(null, { status: 204 });
}
