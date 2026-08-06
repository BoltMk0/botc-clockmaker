import type { AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import type { AmbienceTrackModel } from "$lib/audio/common/model/ambienceTrackModel";
import type { ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
import type { ClocktowerModel } from "$lib/model/common/ClocktowerModel";

export type WSMessageBase = {
    type: string;
};

export type ClockMessage = WSMessageBase & {
    type: 'clock';
    model: ClocktowerModel;
};

export type SyncMessage = WSMessageBase & {
    type: 'sync';
    serverTime: number;
};

export type BellRingRequestMessage = WSMessageBase & {
    type: 'bellRingRequest';
    bell: 'final' | 'reminder';
    atTime?: number;
};

export type ClockAudioParamsMessage = WSMessageBase & {
    type: 'clockAudioModel';
    model: ClocktowerAudioTrackModel;
};

export type AmbienceEngineUpdateMessage = WSMessageBase & {
    type: 'ambienceEngineUpdate',
    model: AmbienceEngineModel
};

export type AmbienceTrackUpdateMessage = WSMessageBase & {
    type: 'ambienceTrackUpdate',
    index: number;
    model: AmbienceTrackModel;
};

export type WSMessage = 
    |ClockMessage
    |SyncMessage
    |BellRingRequestMessage
    |ClockAudioParamsMessage
    |AmbienceEngineUpdateMessage
    |AmbienceTrackUpdateMessage
    ;
