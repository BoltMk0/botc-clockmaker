import { json } from '@sveltejs/kit';
import { getCharacterById } from '$lib/server/database/characters';
import {
    getCharacterImage,
    setCharacterImage,
    deleteCharacterImage
} from '$lib/server/database/Images_base';

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

    const image = getCharacterImage(character);
    if (!image) return json({ error: 'No image found for this character' }, { status: 404 });

    return new Response(new Uint8Array(image.data), {
        headers: { 'Content-Type': image.mimetype }
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

    setCharacterImage(character, buffer, mimeType);
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const { character, error } = await resolveCharacter(params.id);
    if (error) return error;

    const deleted = deleteCharacterImage(character);
    if (!deleted) return json({ error: 'No image found for this character' }, { status: 404 });
    return new Response(null, { status: 204 });
}
