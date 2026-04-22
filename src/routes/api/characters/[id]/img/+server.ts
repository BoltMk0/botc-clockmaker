import { json } from '@sveltejs/kit';
import { getCharacterById } from '$lib/database/server/characters';
import { getCharacterImageResource, setCharacterImageResource, deleteCharacterImageResource } from '$lib/resources/server/character-images';
import { getResourceData } from '$lib/resources/server/resources';


const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

async function resolveCharacter(idParam: string) {
    const id = Number(idParam);
    if (!Number.isInteger(id)) return { character: null, error: json({ error: 'Invalid id' }, { status: 400 }) };
    const character = await getCharacterById(id);
    if (!character) return { character: null, error: json({ error: 'Character not found' }, { status: 404 }) };
    return { character, error: null };
}

export async function GET({ params }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const res = getCharacterImageResource(character.id);
    if (!res) return json({ error: 'No image found for this character' }, { status: 404 });

    const data = getResourceData(res);
    if (!data) return json({ error: 'Failed to read image data' }, { status: 500 });

    return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': res.mimetype }
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

    setCharacterImageResource(character.id, buffer, mimeType);
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const deleted = deleteCharacterImageResource(character.id);
    if (!deleted) return json({ error: 'No image found for this character' }, { status: 404 });
    return new Response(null, { status: 204 });
}
