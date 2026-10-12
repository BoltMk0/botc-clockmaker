import { listFeedback } from "$lib/resources/server/feedback";

export async function load() {
    return { entries: listFeedback() };
}
