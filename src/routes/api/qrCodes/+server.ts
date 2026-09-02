import { getQrCodes, isQrCode, saveQrCodes } from "$lib/resources/server/qrCodes";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getQrCodes());
}

export async function POST({ request }) {
    const data = await request.json();
    if (!Array.isArray(data)) return error(400, { message: 'Expected an array' });
    for (const item of data) {
        if (!isQrCode(item)) return error(400, { message: 'Invalid data - not valid QR code entries' });
    }
    saveQrCodes(data);
    return new Response();
}
