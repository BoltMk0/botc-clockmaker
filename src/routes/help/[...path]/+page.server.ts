import { error } from '@sveltejs/kit';
import { getWikiNav, getWikiPage } from '$lib/help/server/wiki';

export function load({ url }) {
    const page = getWikiPage(url.pathname);
    if (!page) error(404, 'Help page not found');
    return { page, nav: getWikiNav() };
}
