import { getLightingService } from '$lib/lighting/server/service';

/** A Lightscapes hub connecting: it's checked by its id and secret (not a session), and answered with its event stream. */
export async function POST({ request }) {
    return getLightingService().controller.handleConnect(request);
}
