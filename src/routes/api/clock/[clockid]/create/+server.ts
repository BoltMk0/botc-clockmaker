import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { json } from '@sveltejs/kit';

export async function POST({params}) {
    console.log("Creating clock...");
    const manager = getBOTCTClockInstanceManager();
    const {id, instance} = manager.newInstance(params.clockid);
    return json(instance);
}
