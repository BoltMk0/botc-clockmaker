import { isClocktowerAudioTrackModel } from '$lib/audio/common/model/clocktowerAudioTrackModel.svelte.js';
import { isClocktowerModel } from '$lib/model/common/ClocktowerModel.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { error } from '@sveltejs/kit';

export async function POST({ params, request }) {
    console.log("Received audio params update request for clock", params.clockid);
    const body = await request.json();
    if(!isClocktowerAudioTrackModel(body)) return error(400, {message: 'Body is not a valid ClocktowerAudioTracKModel'})
    const instanceManager = getBOTCTClockInstanceManager();
    const instance = instanceManager.getInstance(params.clockid);
    if (!instance) {
        console.error(`No instance found with id: ${params.clockid}`);
        return new Response(JSON.stringify({ error: 'Instance not found' }), { status: 404 });
    }
    instance.audioGain = body.gain;
    instance.audioPan = body.pan;
    instance.audioBalance = body.balance;
    instance.finalBellResourceId = body.resources.finalBell;
    instance.reminderBellResourceId = body.resources.reminderBell;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
}