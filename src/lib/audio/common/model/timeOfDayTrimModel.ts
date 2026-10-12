import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

/** Shared per-phase trim on the Music & Ambience master, in dB: the master level is raised/lowered by the current phase's value. */
export type TimeOfDayTrimModel = Record<TimeOfDay, number>;

/** Range of each trim, in dB either side of 0. */
export const TIME_OF_DAY_TRIM_RANGE_DB = 12;

export function clampTimeOfDayTrim(db: number): number {
    return Math.min(TIME_OF_DAY_TRIM_RANGE_DB, Math.max(-TIME_OF_DAY_TRIM_RANGE_DB, db));
}

export function newTimeOfDayTrimModel(): TimeOfDayTrimModel {
    return { day: 0, dusk: 0, night: 0 };
}

export function isTimeOfDayTrimModel(value: unknown): value is TimeOfDayTrimModel {
    if (typeof value !== 'object' || value === null) return false;
    return TIMES_OF_DAY.every((phase) => typeof (value as any)[phase] === 'number' && isFinite((value as any)[phase]));
}

/** The linear gain multiplier for a phase's trim. */
export function timeOfDayTrimGain(model: TimeOfDayTrimModel, timeOfDay: TimeOfDay): number {
    return Math.pow(10, model[timeOfDay] / 20);
}
