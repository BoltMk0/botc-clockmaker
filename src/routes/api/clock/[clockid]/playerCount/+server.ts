import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function GET({params}){
    const {clockid} = params;
    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    if(!clock){
        return new Response("Clock not found", {status: 404});
    }

    return new Response(JSON.stringify({playerCount: clock.playerCount}), {headers: {"Content-Type": "application/json"}});
}

export async function POST({params, request}){
    const {clockid} = params;


    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    if(!clock){
        console.error(`Failed to set playerCount: Failed to find clock with id ${clockid}`);
        return new Response("Clock not found", {status: 404});
    }

    const body = await request.json();
    const {playerCount} = body;

    if(typeof playerCount !== 'number' || playerCount < 0){
        console.error(`Failed to set playerCount: Invalid player count: ${playerCount}`);
        return new Response("Invalid player count", {status: 400});
    }
    console.log(`Setting player count for clock ${clockid} to ${playerCount}`);
    clock.setPlayerCount(playerCount);
    return new Response(null, {status: 204});
}