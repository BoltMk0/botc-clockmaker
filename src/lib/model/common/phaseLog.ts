import { isTimeOfDay, TIMES_OF_DAY, type TimeOfDay } from "../client/types";

/**
 * When a phase of the game began: the server's time (ms since the epoch), and the day it's of. A new game starts at
 * dusk on day 0 with an empty log; its first entry is the first change of phase (normally night on day 0). Each phase
 * lasts until the next entry begins, so the last one (the phase the game is in, or the one it ended in) has no length yet.
 */
export type PhaseLogEntry = {
    timeOfDay: TimeOfDay;
    day: number;
    at: number;
};

export function isPhaseLog(data: any): data is PhaseLogEntry[] {
    return Array.isArray(data) && data.every(entry =>
        typeof entry === 'object' && entry !== null
        && isTimeOfDay(entry.timeOfDay) && typeof entry.day === 'number' && typeof entry.at === 'number');
}

export type PhaseTimes = Record<TimeOfDay, number>;

function noTimes(): PhaseTimes {
    return { morning: 0, day: 0, dusk: 0, night: 0 };
}

export type PhaseStats = {
    /** The time (ms) spent in each phase, all days together. */
    totals: PhaseTimes;
    /** Each day's time (ms) in each phase, in order of day: night 0 is day 0's. */
    days: { day: number; phases: PhaseTimes; total: number }[];
    /** All the time in the phases that have ended (ms). */
    total: number;
    /** The days from morning to the end of their night, i.e. that the game has moved on from (day 0, a night only, isn't one). */
    fullDays: number;
    /** The average full day (ms), or null with none. */
    averageDay: number | null;
    /** The average time (ms) a day spent in each phase, over the days that had the phase, or null for one no day had. */
    averagePhase: Record<TimeOfDay, number | null>;
};

/**
 * How the game's time divides between its phases, leaving out the last phase in the log: it's still going (or the
 * game's over, and it's the storyteller going over the game with the players).
 */
export function phaseStats(log: readonly PhaseLogEntry[]): PhaseStats {
    const totals = noTimes();
    const byDay = new Map<number, PhaseTimes>();
    for (let i = 0; i < log.length - 1; i++) {
        const { timeOfDay, day, at } = log[i];
        const ms = Math.max(0, log[i + 1].at - at);
        totals[timeOfDay] += ms;
        let phases = byDay.get(day);
        if (!phases) byDay.set(day, phases = noTimes());
        phases[timeOfDay] += ms;
    }
    const days = [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, phases]) => ({ day, phases, total: TIMES_OF_DAY.reduce((sum, p) => sum + phases[p], 0) }));

    // A day's over once the game's moved on to a later one
    const lastDay = log.length ? log[log.length - 1].day : 0;
    const full = days.filter(d => d.day >= 1 && d.day < lastDay);

    const averagePhase = {} as Record<TimeOfDay, number | null>;
    for (const phase of TIMES_OF_DAY) {
        const had = days.filter(d => d.phases[phase] > 0);
        averagePhase[phase] = had.length ? had.reduce((sum, d) => sum + d.phases[phase], 0) / had.length : null;
    }

    return {
        totals,
        days,
        total: TIMES_OF_DAY.reduce((sum, p) => sum + totals[p], 0),
        fullDays: full.length,
        averageDay: full.length ? full.reduce((sum, d) => sum + d.total, 0) / full.length : null,
        averagePhase
    };
}

/** A length of time as h:mm:ss, or m:ss under an hour. */
export function formatDuration(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = seconds % 60;
    const ss = s.toString().padStart(2, '0');
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
