import { validateConfig } from "$lib/common/config";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model.js";
import { error, json } from "@sveltejs/kit";

export async function GET({params}){
    const instance = getBOTCTClockInstanceManager().getInstance(params.clockid);
    return json(instance.getConfig());
}

export async function POST({request, params}: {request: Request, params: {clockid: string}}){
    const body = await request.json();
    if(!validateConfig(body)) {
        console.error("Invalid config received:", body);
        return json({status: 'error', message: 'Invalid config'}, {status: 400});
    }
    const instance = getBOTCTClockInstanceManager().getInstance(params.clockid);
    instance.setConfig(body);
    console.log("Config updated:", body);
    return json({status: 'ok'});
}

export async function DELETE({params}){
    try {
        getBOTCTClockInstanceManager().freeInstance(params.clockid);
        return new Response("Clock deleted");
    } catch {
        return error(400, "Failed to delete clock");
    }
}