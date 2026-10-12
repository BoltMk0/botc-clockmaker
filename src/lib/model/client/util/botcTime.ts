
export type BOTCTimeType = {
    time: number;
    reference: 'server' | 'local';
}

export function BOTCTimeTypeNow(): BOTCTimeType {
    return { time: Date.now(), reference: 'local' } as BOTCTimeType;
}

export function BOTCTimeTypeSubstract(time: BOTCTimeType, delta: number): BOTCTimeType{
    return {
        time: time.time - delta,
        reference: time.reference
    }
}

