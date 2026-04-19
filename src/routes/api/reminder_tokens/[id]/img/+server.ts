import { json } from '@sveltejs/kit';
import {getReminderTokenById} from '$lib/server/database/reminder_tokens';
import {
    getReminderTokenImage,
    setReminderTokenImage,
    deleteReminderTokenImage
} from '$lib/server/database/Images_base';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

async function resolveToken(idParam: string) {
    const id = Number(idParam);
    if (!Number.isInteger(id)) return { id: 0, error: json({ error: 'Invalid id' }, { status: 400 }) };
    const token = await getReminderTokenById(id);
    if (!token) return { id: 0, error: json({ error: 'Token not found' }, { status: 404 }) };
    return { id, error: null };
}

export async function GET({ params }) {
    const { id, error } = await resolveToken(params.id);
    if (error) return error;

    const image = getReminderTokenImage(id);
    if (!image) return json({ error: 'No image found for this token' }, { status: 404 });

    return new Response(new Uint8Array(image.data), {
        headers: { 'Content-Type': image.mimetype }
    });
}

export async function PUT({ params, request }) {
    const { id, error } = await resolveToken(params.id);
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

    setReminderTokenImage(id, buffer, mimeType);
    return new Response(null, { status: 204 });
}

export async function DELETE({ params }) {
    const { id, error } = await resolveToken(params.id);
    if (error) return error;

    const deleted = deleteReminderTokenImage(id);
    if (!deleted) return json({ error: 'No image found for this token' }, { status: 404 });
    return new Response(null, { status: 204 });
}
