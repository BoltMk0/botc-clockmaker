import { listRulesSlidesResoirces } from '$lib/resources/server/rules-slides';

export async function load(){
    return {
        slides: listRulesSlidesResoirces()
    };
}
