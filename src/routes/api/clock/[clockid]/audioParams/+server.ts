import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function POST({ params, request }) {
    console.log("Received audio params update request for clock", params.clockid);
    const body = await request.json();
    const { gain, pan } = body;
    const instanceManager = getBOTCTClockInstanceManager();
    const instance = instanceManager.getInstance(params.clockid);
    if (!instance) {
        console.error(`No instance found with id: ${params.clockid}`);
        return new Response(JSON.stringify({ error: 'Instance not found' }), { status: 404 });
    }
    instance.setAudioParams({ gain, pan });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
}