import { isTimerOption } from '$lib/common/timerOption.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { error } from '@sveltejs/kit';

export async function POST({ request, params }) {
    const data = await request.json();
    if(!isTimerOption(data)) return error(400, {message: 'Is not a valid timer option'});
    const manager = getBOTCTClockInstanceManager();
    const clock = manager.getInstance(params.clockid);
    clock.setup(data);
    return new Response(null, { status: 200 });
}