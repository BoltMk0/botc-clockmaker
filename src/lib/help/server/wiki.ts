import { Marked, type Tokens } from 'marked';

/**
 * The help wiki: the user guide (wiki/), then the developer documentation (README.md and doc/) under "Developer".
 * The Markdown is bundled at build time, so the pages work wherever the app is deployed.
 */

const sources: Record<string, string> = {
    ...import.meta.glob('/wiki/**/*.md', { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob('/README.md', { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob('/doc/**/*.md', { query: '?raw', import: 'default', eager: true })
};

/** Images the docs show (repo path → bundled URL). */
const images: Record<string, string> = import.meta.glob('/res/*.{jpg,jpeg,png,webp,gif,svg}', {
    query: '?url', import: 'default', eager: true
});

/** Links to repo files that aren't part of the wiki (e.g. lightscapes/README.md, scripts/) go to GitHub. */
const REPO_URL = 'https://github.com/BoltMk0/botc-clockmaker/blob/main';

export const HELP_ROOT = '/help';
const DEVELOPER_ROUTE = `${HELP_ROOT}/developer`;

export interface NavNode {
    title: string;
    href: string;
    children: NavNode[];
}

export interface WikiPage {
    title: string;
    html: string;
    /** Repo path of the source file, e.g. "doc/grimoire.md". */
    source: string;
}

/** "/doc/grimoire.md" (glob key) → "doc/grimoire.md" */
const repoPath = (key: string) => key.replace(/^\//, '');

const isIndex = (file: string) => /(^|\/)(README|index)\.md$/.test(file);

/** Repo path → wiki route. Index pages (README.md / index.md) are their folder's route. */
function routeFor(file: string): string | null {
    const stripIndex = (p: string) => p.replace(/(^|\/)(README|index)\.md$/, '').replace(/\.md$/, '');
    let route: string;
    if (file.startsWith('wiki/')) route = HELP_ROOT + '/' + stripIndex(file.slice('wiki/'.length));
    else if (file === 'README.md') route = DEVELOPER_ROUTE;
    else if (file.startsWith('doc/')) route = DEVELOPER_ROUTE + '/' + stripIndex(file);
    else return null;
    return route.replace(/\/+$/, '');
}

const files = Object.keys(sources).map(repoPath);
const fileByRoute = new Map<string, string>();
for (const file of files) {
    const route = routeFor(file);
    if (route) fileByRoute.set(route, file);
}

function titleOf(file: string): string {
    const heading = sources['/' + file].match(/^#\s+(.+)$/m)?.[1];
    return heading?.replace(/[*_`]/g, '').trim() ?? file.split('/').pop()!.replace(/\.md$/, '');
}

/** Normalises "a/b/../c.md" style paths. Returns null if it climbs out of the repo. */
function normalise(path: string): string | null {
    const out: string[] = [];
    for (const part of path.split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
            if (!out.length) return null;
            out.pop();
        } else out.push(part);
    }
    return out.join('/');
}

const dirOf = (file: string) => file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';

/** A relative link in `file` → the repo path it points to, or null for absolute/external links. */
function resolveRepoPath(file: string, href: string): string | null {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/') || href.startsWith('#')) return null;
    return normalise(dirOf(file) + href);
}

function rewriteHref(file: string, href: string): string {
    const [path, hash] = href.split('#', 2) as [string, string | undefined];
    const target = path ? resolveRepoPath(file, decodeURI(path)) : null;
    if (target === null) return href;
    const suffix = hash !== undefined ? '#' + hash : '';
    const route = sources['/' + target] !== undefined ? routeFor(target) : null;
    if (route) return route + suffix;
    if (images['/' + target]) return images['/' + target];
    return `${REPO_URL}/${target}${suffix}`;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function decodeEntities(s: string): string {
    return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
        if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
        return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()];
    });
}

/** GitHub-style heading anchors, so the docs' existing #links keep working. */
function makeSlugger() {
    const seen = new Map<string, number>();
    return (text: string) => {
        const base = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return count ? `${base}-${count}` : base;
    };
}

function render(file: string): string {
    const slug = makeSlugger();
    const marked = new Marked({
        gfm: true,
        renderer: {
            heading({ tokens, depth }: Tokens.Heading) {
                const inner = this.parser.parseInline(tokens);
                const id = slug(decodeEntities(inner.replace(/<[^>]+>/g, '')));
                return `<h${depth} id="${escapeAttr(id)}"><a class="heading-anchor" href="#${escapeAttr(id)}" aria-hidden="true">#</a>${inner}</h${depth}>\n`;
            },
            link({ href, title, tokens }: Tokens.Link) {
                const url = rewriteHref(file, href);
                const external = /^https?:/i.test(url);
                return `<a href="${escapeAttr(url)}"${title ? ` title="${escapeAttr(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${this.parser.parseInline(tokens)}</a>`;
            },
            image({ href, title, text }: Tokens.Image) {
                const url = rewriteHref(file, href);
                return `<img src="${escapeAttr(url)}" alt="${escapeAttr(text)}"${title ? ` title="${escapeAttr(title)}"` : ''} loading="lazy" />`;
            }
        }
    });
    return marked.parse(sources['/' + file], { async: false });
}

const rendered = new Map<string, WikiPage>();

export function getWikiPage(route: string): WikiPage | null {
    const normalised = route.replace(/\/+$/, '') || HELP_ROOT;
    const file = fileByRoute.get(normalised);
    if (!file) return null;
    let page = rendered.get(file);
    if (!page) {
        page = { title: titleOf(file), html: render(file), source: file };
        rendered.set(file, page);
    }
    return page;
}

/**
 * The order pages are first linked from `index` (their folder's README/index), so the navigation follows the
 * reading order the docs already set out. Pages it doesn't link come after, alphabetically.
 */
function linkOrder(index: string | undefined): Map<string, number> {
    const order = new Map<string, number>();
    if (!index) return order;
    for (const match of sources['/' + index].matchAll(/\]\(([^)\s#]+)/g)) {
        const target = resolveRepoPath(index, match[1]);
        if (target && !order.has(target)) order.set(target, order.size);
    }
    return order;
}

/** The navigation for one folder: its index page, with its pages and sub-folders as children. */
function folderNode(dir: string, fallbackTitle: string): NavNode | null {
    const inDir = files.filter(f => f.startsWith(dir) && f !== dir);
    const index = inDir.find(f => isIndex(f) && dirOf(f) === dir);
    const pages = inDir.filter(f => dirOf(f) === dir && f !== index);
    const subdirs = [...new Set(inDir.filter(f => dirOf(f) !== dir).map(f => dir + f.slice(dir.length).split('/')[0] + '/'))];

    const order = linkOrder(index);
    const children = [
        ...pages.map(f => ({ key: f, node: { title: titleOf(f), href: routeFor(f)!, children: [] } as NavNode })),
        ...subdirs.flatMap(d => {
            const node = folderNode(d, d.slice(dir.length, -1));
            const sub = files.find(f => dirOf(f) === d && isIndex(f));
            return node ? [{ key: sub ?? d, node }] : [];
        })
    ].sort((a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity) || a.node.title.localeCompare(b.node.title))
        .map(c => c.node);

    if (!index && !children.length) return null;
    return { title: index ? titleOf(index) : fallbackTitle, href: index ? routeFor(index)! : children[0].href, children };
}

let nav: NavNode[] | null = null;

/** The wiki's navigation: the user guide's pages at the top level, then the Developer tree. */
export function getWikiNav(): NavNode[] {
    if (nav) return nav;
    const userGuide = folderNode('wiki/', 'Help');
    const docs = folderNode('doc/', 'Documentation');
    const developer: NavNode = {
        title: 'Developer',
        href: DEVELOPER_ROUTE,
        children: [
            ...(sources['/README.md'] !== undefined ? [{ title: 'README', href: DEVELOPER_ROUTE, children: [] }] : []),
            ...(docs ? [docs] : [])
        ]
    };
    nav = [
        ...(userGuide ? [{ ...userGuide, title: 'Home', children: [] }, ...userGuide.children] : []),
        developer
    ];
    return nav;
}
