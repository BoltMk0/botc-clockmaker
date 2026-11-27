import { validateGrimoireState, type GrimoireStateSnapshot } from "./grimoireState";

export type PresetWinner = 'good' | 'evil';

/** One game played from a preset. */
export type PresetPlay = {
    id: string;
    preset_id: string;
    /** The day it was played, as YYYY-MM-DD. */
    date: string;
    winner: PresetWinner;
    /** The virtual grim as it was when the game was ended from it; absent for games logged by hand. */
    grim?: {
        script_id: string | null;
        snapshot: GrimoireStateSnapshot;
        /** The clock's in-game day when the game ended; absent when it wasn't known or the game hadn't started. */
        day?: number;
    };
};

/** A play as sent to lists: whether it has a grim snapshot (and its day), not the snapshot itself. */
export type PresetPlaySummary = Omit<PresetPlay, 'grim'> & { has_grim: boolean; day?: number };

/** A play in the list of every game, with what it was played from. */
export type PlayHistoryEntry = PresetPlaySummary & {
    preset_name: string;
    script_id: string;
    script_name: string | null;
};

/** Most recent first; ids are time-ordered (v7), so they break ties between plays on the same day. */
export function byMostRecentPlay(a: Pick<PresetPlay, 'date' | 'id'>, b: Pick<PresetPlay, 'date' | 'id'>): number {
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

const playDateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortPlayDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** A play's YYYY-MM-DD date for showing, e.g. "Wed, 25 Nov 2026" (or "25 Nov 2026" when short). */
export function formatPlayDate(value: string, short = false): string {
    const [y, m, d] = value.split('-').map(Number);
    return (short ? shortPlayDateFormat : playDateFormat).format(new Date(y, m - 1, d));
}

/** What the grim snapshot view shows for a play. */
export function snapshotViewProps(play: PresetPlay) {
    const won = play.winner === 'good' ? 'Good' : 'Evil';
    return {
        title: `${formatPlayDate(play.date)} · ${play.grim?.day ? `Day ${play.grim.day} · ` : ''}${won} won`,
        when: formatPlayDate(play.date, true),
        filename: `grim-${play.date}-${play.winner}-wins`,
        winner: play.winner,
        day: play.grim?.day,
        scriptId: play.grim?.script_id ?? null
    };
}

export function isPresetWinner(value: unknown): value is PresetWinner {
    return value === 'good' || value === 'evil';
}

export function isPlayDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function isPresetPlay(obj: any): obj is PresetPlay {
    return !!obj && typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.preset_id === 'string' &&
        isPlayDate(obj.date) &&
        isPresetWinner(obj.winner) &&
        (obj.grim === undefined || (
            typeof obj.grim === 'object' &&
            (obj.grim.script_id === null || typeof obj.grim.script_id === 'string') &&
            (obj.grim.day === undefined || (Number.isInteger(obj.grim.day) && obj.grim.day > 0)) &&
            validateGrimoireState(obj.grim.snapshot)
        ));
}

/** Today's date in the local time zone, as YYYY-MM-DD. */
export function todayPlayDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// "today" and "yesterday", but "1 week ago" rather than "last week", which reads oddly after "Last played".
const relativeDayFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });

/** How long ago a YYYY-MM-DD play date was, from today, e.g. "yesterday", "2 weeks ago", "3 months ago". */
export function formatPlayedAgo(value: string): string {
    const [y, m, d] = value.split('-').map(Number);
    const [ty, tm, td] = todayPlayDate().split('-').map(Number);
    // Whole calendar days, counted in UTC so daylight saving doesn't shift them.
    const days = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000));
    if (days < 7) return relativeDayFormat.format(-days, 'day');
    if (days < 30) return relativeFormat.format(-Math.floor(days / 7), 'week');
    const months = Math.round(days / 30.44);
    if (months < 12) return relativeFormat.format(-Math.max(1, months), 'month');
    return relativeFormat.format(-Math.max(1, Math.round(days / 365.25)), 'year');
}
