import { makeResourceRESTAPI } from "$lib/server/util";

export const {GET, POST, DELETE} = makeResourceRESTAPI(
    `ambience/[resourceid]`,
    ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'],
    {GET: true, POST: true, DELETE: true}
);
