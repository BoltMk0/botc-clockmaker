import { validateGrimoireStateHistory, type GrimoireStateHistory } from "../../routes/admin/games/[id]/grimoire/types";
import { deleteResource, findResourceById, encodeResourceId, getResourceData, saveResource } from "../resources/server/resources";

export function get_grimoire_state_history_resource_for_game(gameid: number): GrimoireStateHistory | null {
    const resourceid = encodeResourceId('grimoirestate', `game-${gameid}`);
    let resource = findResourceById(resourceid);
    if(!resource){
        console.debug("No grimoire state history resource found for game", gameid);
        return null;
    } else {
        console.debug("Grimoire state history resource found for game", gameid);
        const raw = getResourceData(resource) as Buffer;
        if(!raw){
            console.error(`Grimoire state history resource found for game ${gameid} but failed to read data`);
            return null;
        }
        try{
            const parsed = JSON.parse(raw.toString());
            if(validateGrimoireStateHistory(parsed)){
                return parsed;
            } else {
                console.error(`Grimoire state history resource data failed validation for game ${gameid}`);
                return null;
            }
        }catch(e){
            console.error(`Error parsing grimoire state history resource for game ${gameid}:`, e);
            return null;
        }
    }
}

export function set_grimoire_state_history_resource_for_game(gameid: number, history: GrimoireStateHistory) {
    const resourceid = encodeResourceId('grimoirestate', `game-${gameid}`, 'application/json');
    const data = Buffer.from(JSON.stringify(history));
    saveResource(resourceid, data);
}

export function delete_grimoire_state_history_resource_for_game(gameid: number){
    const resourceid = encodeResourceId('grimoirestate', `game-${gameid}`, 'application/json');
    deleteResource(resourceid);
}