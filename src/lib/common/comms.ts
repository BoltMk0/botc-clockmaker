import type { AudioParams } from "./AudioParams";

export type WSMessage = {
    type: string;
};

export type ClockMessage = WSMessage & {
    type: 'clock';
    running: boolean;
    startTime: number;
    duration: number;
    ringBellAfter: number|null;
};

export type DayMessage = WSMessage & {
    type: 'day';
    day: number;
    max: number;
};

export type SyncMessage = WSMessage & {
    type: 'sync';
    serverTime: number;
};

export type BellRingRequestMessage = WSMessage & {
    type: 'bellRingRequest';
    atTime?: number;
};

export type AudioParamsMessage = WSMessage & AudioParams & {
    type: 'audioParams';
};

export type PlayerCountMessage = WSMessage & {
    type: 'playerCount';
    playerCount: number;
}