import { makeResourceRESTAPI } from "$lib/server/util";

export const {GET, POST, DELETE} = makeResourceRESTAPI(
    'sounds/reminder-bell-[clockid]',
    ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'],
    {GET: true, POST: true, DELETE: true},
    '/resources/reminder-bell'
);
