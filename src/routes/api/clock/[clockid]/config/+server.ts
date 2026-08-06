import { isConfig } from "$lib/common/config";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model.js";
import { json } from "@sveltejs/kit";

export async function GET({params}){
    const instance = getBOTCTClockInstanceManager().getInstance(params.clockid);
    return json(instance.model.config);
}

export async function POST({request, params}: {request: Request, params: {clockid: string}}){
    const body = await request.json();
    if(!isConfig(body)) {
        console.error("Invalid config received:", body);
        return json({status: 'error', message: 'Invalid config'}, {status: 400});
    }
    const instance = getBOTCTClockInstanceManager().getInstance(params.clockid);
    instance.config = body;
    console.log("Config updated:", body);
    return json({status: 'ok'});
}

