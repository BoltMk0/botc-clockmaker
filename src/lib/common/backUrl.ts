/**
 * The page a back link goes to, from a page's `backUrl` parameter. Only same-site paths, so a shared link can't send
 * people off to another site. (Browsers read "//x" and "/\x" as links to the site x.)
 */
export function backUrlFrom(url: URL): string | null {
    const backUrl = url.searchParams.get('backUrl');
    return backUrl && /^\/(?![/\\])/.test(backUrl) ? backUrl : null;
}
