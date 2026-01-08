import { validateConfig } from "$lib/common/config";
import { getBOTCTClockInstance } from "$lib/server/model";
import { json } from "@sveltejs/kit";

export async function GET(){
    const instance = getBOTCTClockInstance();
    return json(instance.config);
}

export async function POST({request}: {request: Request}){
    const body = await request.json();
    if(!validateConfig(body)) {
        return json({status: 'error', message: 'Invalid config'}, {status: 400});
    }
    const instance = getBOTCTClockInstance();
    instance.config = body;
    return json({status: 'ok'});
}

