import { getLightingService } from '$lib/lighting/server/service';

/** What an approved Lightscapes hub sends: its lights, their states, its status and button presses. */
export async function POST({ request }) {
    return getLightingService().controller.handleMessages(request);
}
