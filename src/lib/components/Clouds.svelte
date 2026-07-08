<script lang="ts">
    export let style: string = "";
    export let skyColor: string = "white";

    type CloudConfig = {
        size: number; // width, as a % of the layer's width
    };

    // Bigger clouds read as closer, so they scroll faster and are more opaque;
    // smaller clouds read as further away, so they drift slower and fade into haze.
    const CLOUD_CONFIGS: CloudConfig[] = [
        { size: 10},
        { size: 12},
        { size: 14},
        { size: 17},
        { size: 25},
        { size: 27},
        { size: 40},
    ];

    const BASE_DURATION = 45; // seconds for the largest cloud to cross the sky

    // Larger (closer) clouds read as a stronger white; smaller (further) clouds
    // are mixed further towards the sky colour, as if fading into atmospheric haze.
    const MIN_WHITE_MIX = 35;
    const MAX_WHITE_MIX = 75;

    const MIN_BLUR = 4;
    const MAX_BLUR = 6;

    const maxSize = Math.max(...CLOUD_CONFIGS.map(c => c.size));
    const minSize = Math.min(...CLOUD_CONFIGS.map(c => c.size));

    const SIZE_VARIANCE = 0.3

    // Computed once, on component init - must not depend on any reactive prop (like
    // skyColor), otherwise every prop update would re-run Math.random() and reset
    // each cloud's drift/position mid-flight.
    const clouds = CLOUD_CONFIGS.map((cloud) => {
        const duration = BASE_DURATION * (maxSize / cloud.size);
        const sizeRatio = (cloud.size - minSize) / (maxSize - minSize);
        const whiteMix = MIN_WHITE_MIX + (MAX_WHITE_MIX - MIN_WHITE_MIX) * sizeRatio;
        // Randomise each cloud's start point around the loop so they don't move in lockstep.
        const delay = -Math.random() * duration;
        const top = 3 + 70 * (1-sizeRatio);
        const blur = MIN_BLUR + (MAX_BLUR - MIN_BLUR) * (1-sizeRatio)
        const size = cloud.size * (1 - (SIZE_VARIANCE/2) + SIZE_VARIANCE * Math.random());
        return { ...cloud, size, duration, whiteMix, delay, top, blur };
    });
</script>

<div class="clouds-layer" style="--sky-color: {skyColor}; {style}">
    {#each clouds as cloud, i (i)}
        <div
            class="cloud"
            style="
                height: {cloud.size}%;
                top: {cloud.top}%;
                --white-mix: {cloud.whiteMix}%;
                animation-duration: {cloud.duration}s;
                animation-delay: {cloud.delay}s;
                filter: blur({cloud.blur}px);
            "
        ></div>
    {/each}
</div>

<style>
    .clouds-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }

    .cloud {
        position: absolute;
        aspect-ratio: 2.4 / 1;
        background-color: color-mix(in srgb, white var(--white-mix), var(--sky-color));
        border-radius: 999px;
        animation-name: drift;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }

    .cloud::before,
    .cloud::after {
        content: '';
        position: absolute;
        background-color: color-mix(in srgb, white var(--white-mix), var(--sky-color));
        border-radius: 50%;
    }

    .cloud::before {
        width: 55%;
        height: 110%;
        top: -55%;
        left: 8%;
    }

    .cloud::after {
        width: 65%;
        height: 130%;
        top: -70%;
        right: 10%;
    }

    @keyframes drift {
        from { left: -40%; }
        to { left: 140%; }
    }
</style>
