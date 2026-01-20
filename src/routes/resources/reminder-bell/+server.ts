import { makeResourceRESTAPI } from "$lib/server/util";

export const {GET, POST, DELETE} = makeResourceRESTAPI(
    'sounds/reminder-bell',
    ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    {GET: true, POST: true, DELETE: true},
    '/resources/final-bell'
);

