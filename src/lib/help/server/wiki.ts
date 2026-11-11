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
const images: Record<string, string> = import.meta.glob(['/res/*.{jpg,jpeg,png,webp,gif,svg}', '/wiki/**/*.{jpg,jpeg,png,webp,gif,svg}'], {
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
    /** The page's ## and ### headings, for its "On this page" contents. */
    toc: TocEntry[];
}

export interface TocEntry {
    id: string;
    text: string;
    depth: 2 | 3;
}

/** "/doc/grimoire.md" (glob key) → "doc/grimoire.md" */
const repoPath = (key: string) => key.replace(/^\//, '');

const isIndex = (file: string) => /(^|\/)(README|index)\.md$/.test(file);

/** A leading ordering prefix on a wiki file or folder name, e.g. the "01_" in "01_quickstart.md". */
const ORDER_PREFIX = /^\d+[_\-. ]+(?=.)/;

/** Repo path → wiki route. Index pages (README.md / index.md) are their folder's route. Ordering prefixes are dropped. */
function routeFor(file: string): string | null {
    const stripIndex = (p: string) => p.replace(/(^|\/)(README|index)\.md$/, '').replace(/\.md$/, '');
    let route: string;
    if (file.startsWith('wiki/')) {
        route = HELP_ROOT + '/' + stripIndex(file.slice('wiki/'.length)).split('/').map(s => s.replace(ORDER_PREFIX, '')).join('/');
    }
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

/** A file or folder name as a title: "02_hello_world.md" → "Hello world". */
function prettify(name: string): string {
    const words = name.replace(/\.md$/, '').replace(ORDER_PREFIX, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The file's first "# " heading, else its name made readable. */
function titleOf(file: string): string {
    const heading = sources['/' + file].match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, '').trim();
    return heading || prettify(file.split('/').pop()!);
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

/**
 * A link in `file` → the repo path it points to, or null for external links and fragments. Relative links resolve
 * against the file's folder; a "/"-rooted link is a repo path (e.g. /wiki/images/x.webp) if that file is bundled.
 */
function resolveRepoPath(file: string, href: string): string | null {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return null;
    if (href.startsWith('/')) {
        const path = normalise(href);
        return path !== null && (sources['/' + path] !== undefined || images['/' + path]) ? path : null;
    }
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

function render(file: string): { html: string; toc: TocEntry[] } {
    const slug = makeSlugger();
    const toc: TocEntry[] = [];
    const marked = new Marked({
        gfm: true,
        renderer: {
            heading({ tokens, depth }: Tokens.Heading) {
                const inner = this.parser.parseInline(tokens);
                const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
                const id = slug(text);
                if (depth === 2 || depth === 3) toc.push({ id, text: text.trim(), depth });
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
    const html = marked.parse(sources['/' + file], { async: false });
    return { html, toc };
}

const rendered = new Map<string, WikiPage>();

export function getWikiPage(route: string): WikiPage | null {
    const normalised = route.replace(/\/+$/, '') || HELP_ROOT;
    const file = fileByRoute.get(normalised);
    if (!file) return null;
    let page = rendered.get(file);
    if (!page) {
        page = { title: titleOf(file), ...render(file), source: file };
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

/**
 * The user guide's navigation for one wiki folder: its files and sub-folders in file-name order (so "01_..."
 * prefixes set the order). A sub-folder is a subtree titled and linked by its index.md, if it has one.
 */
function wikiChildren(dir: string): NavNode[] {
    const inDir = files.filter(f => f.startsWith(dir));
    const entries = [...new Set(inDir.map(f => f.slice(dir.length).split('/')[0]))]
        .filter(name => name !== 'index.md')
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return entries.flatMap((name): NavNode[] => {
        const path = dir + name;
        if (sources['/' + path] !== undefined) return [{ title: titleOf(path), href: routeFor(path)!, children: [] }];
        const children = wikiChildren(path + '/');
        const index = sources['/' + path + '/index.md'] !== undefined ? path + '/index.md' : null;
        if (!index && !children.length) return [];
        return [{ title: index ? titleOf(index) : prettify(name), href: index ? routeFor(index)! : children[0].href, children }];
    });
}

/** The wiki's navigation, built once: Home (wiki/index.md) and the user guide's pages at the top level, then the Developer tree. */
const nav: NavNode[] = (() => {
    const docs = folderNode('doc/', 'Documentation');
    const developer: NavNode = {
        title: 'Developer',
        href: DEVELOPER_ROUTE,
        children: [
            ...(sources['/README.md'] !== undefined ? [{ title: 'README', href: DEVELOPER_ROUTE, children: [] }] : []),
            ...(docs ? [docs] : [])
        ]
    };
    return [
        ...(sources['/wiki/index.md'] !== undefined ? [{ title: 'Home', href: HELP_ROOT, children: [] }] : []),
        ...wikiChildren('wiki/'),
        developer
    ];
})();

export function getWikiNav(): NavNode[] {
    return nav;
}
