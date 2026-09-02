<script lang="ts">
    import { onMount } from 'svelte';

    let { style = "", skyColor = "white", count = 30 }: { style?: string; skyColor?: string; count?: number } = $props();

    // Each shape has its own viewBox (varying aspect ratios give cloud personalities:
    // tall & dramatic, wide & wispy, puffy & round, etc.) and a list of
    // [cx, cy, rx, ry] ellipses. Using near-circular rx≈ry for bumps gives the
    // cartoony, no-sharp-corners look; smaller satellite ellipses fill gaps.
    const SHAPES = [
        {   // classic friendly — 3 clear circular domes
            viewBox: "0 0 240 100",
            e: [
                [120, 88, 113, 16],  // wide base
                [68,  56,  48, 48],  // left dome
                [138, 40,  58, 58],  // center dome (tallest)
                [196, 64,  40, 40],  // right dome
                [34,  76,  26, 22],  // far-left shoulder fill
                [172, 54,  28, 28],  // right-center fill
            ],
        },
        {   // tall regal — single imposing tower with wide skirt
            viewBox: "0 0 220 120",
            e: [
                [110, 106, 105, 18], // base
                [108,  44,  72, 72], // main tower dome
                [52,   80,  42, 42], // left support dome
                [170,  78,  40, 40], // right support dome
                [68,   56,  26, 26], // upper-left fill
                [150,  60,  24, 24], // upper-right fill
            ],
        },
        {   // puffy crown — three equal peaks, very symmetric and cute
            viewBox: "0 0 260 110",
            e: [
                [130, 96, 122, 18],  // base
                [62,  55,  52, 52],  // left peak
                [130, 42,  56, 56],  // center peak
                [200, 55,  52, 52],  // right peak
                [95,  74,  32, 28],  // left-center fill
                [165, 74,  32, 28],  // right-center fill
            ],
        },
        {   // wind-swept — mass on the right, trailing off to the left
            viewBox: "0 0 300 95",
            e: [
                [150, 82, 148, 17],  // wide base
                [190, 42,  65, 65],  // main dome (right)
                [118, 52,  52, 52],  // second dome (center)
                [56,  68,  38, 34],  // trailing left puff
                [250, 64,  44, 44],  // right shoulder
                [268, 50,  26, 26],  // upper-right fill
                [18,  78,  22, 18],  // far-left wisp
            ],
        },
        {   // fluffy monster — dense cluster of tight circles, very organic
            viewBox: "0 0 250 105",
            e: [
                [125, 92, 118, 17],  // base
                [125, 46,  56, 56],  // center top
                [65,  58,  48, 48],  // left main
                [188, 55,  46, 46],  // right main
                [92,  35,  34, 34],  // upper center-left
                [160, 38,  32, 32],  // upper center-right
                [28,  77,  26, 22],  // far-left shoulder
                [222, 74,  24, 22],  // far-right shoulder
            ],
        },
        {   // flat wispy — wide low-altitude cloud, gentle bumps
            viewBox: "0 0 320 85",
            e: [
                [160, 73, 158, 16],  // super-wide base
                [65,  55,  44, 40],  // left puff
                [160, 44,  54, 48],  // center puff
                [262, 55,  46, 42],  // right puff
                [112, 60,  30, 26],  // left-center fill
                [212, 60,  30, 26],  // right-center fill
                [308, 65,  20, 18],  // far-right trailing wisp
            ],
        },
    ] as const;

    const SIZE_CONFIGS = [10, 12, 14, 17, 25, 27, 40];

    // Bigger clouds read as closer: faster, more opaque, less blurred.
    const BASE_DURATION  = 60; // seconds for the largest cloud to cross the sky
    const MIN_WHITE_MIX  = 45;
    const MAX_WHITE_MIX  = 65;
    const MIN_BLUR       = 4;
    const MAX_BLUR       = 6;
    const SIZE_VARIANCE  = 0.3;
    const RESPAWN_MIN_MS = 0;
    const RESPAWN_MAX_MS = 1_000;

    const maxSize = Math.max(...SIZE_CONFIGS);
    const minSize = Math.min(...SIZE_CONFIGS);

    type Cloud = {
        id: number;
        shapeIndex: number;
        size: number;
        duration: number;
        delay: number;
        top: number;
        whiteMix: number;
        blur: number;
        zIndex: number;
    };

    let clouds = $state<Cloud[]>([]);
    let nextId = 0;

    function makeCloud(initialProgress = 0): Cloud {
        const baseSize  = SIZE_CONFIGS[Math.floor(Math.random() * SIZE_CONFIGS.length)];
        const sizeRatio = (baseSize - minSize) / (maxSize - minSize);
        const duration  = BASE_DURATION * (maxSize / baseSize);
        const size      = baseSize * (1 - SIZE_VARIANCE / 2 + SIZE_VARIANCE * Math.random());
        return {
            id:         nextId++,
            shapeIndex: Math.floor(Math.random() * SHAPES.length),
            size,
            duration,
            delay:    -initialProgress * duration,
            top:       3 + 70 * (1 - sizeRatio),
            whiteMix:  MIN_WHITE_MIX + (MAX_WHITE_MIX - MIN_WHITE_MIX) * sizeRatio,
            blur:      MIN_BLUR + (MAX_BLUR - MIN_BLUR) * (1 - sizeRatio),
            zIndex:    Math.round(sizeRatio * 10),
        };
    }

    function handleAnimationEnd(id: number) {
        clouds = clouds.filter(c => c.id !== id);
        const delay = RESPAWN_MIN_MS + Math.random() * (RESPAWN_MAX_MS - RESPAWN_MIN_MS);
        setTimeout(() => {
            clouds = [...clouds, makeCloud(0)];
        }, delay);
    }

    onMount(() => {
        // Spread initial clouds across the sky so they don't all enter together.
        clouds = Array.from({ length: count }, () => makeCloud(Math.random()));
    });
</script>

<div class="clouds-layer" style="--sky-color: {skyColor}; {style}">
    {#each clouds as cloud (cloud.id)}
        <svg
            class="cloud"
            viewBox={SHAPES[cloud.shapeIndex].viewBox}
            xmlns="http://www.w3.org/2000/svg"
            style="
                height: {cloud.size}%;
                top: {cloud.top}%;
                --white-mix: {cloud.whiteMix}%;
                animation-duration: {cloud.duration}s;
                animation-delay: {cloud.delay}s;
                filter: blur({cloud.blur}px);
                z-index: {cloud.zIndex};
            "
            onanimationend={() => handleAnimationEnd(cloud.id)}
        >
            {#each SHAPES[cloud.shapeIndex].e as [cx, cy, rx, ry]}
                <ellipse {cx} {cy} {rx} {ry} />
            {/each}
        </svg>
    {/each}
</div>

<style>
    .clouds-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        isolation: isolate; /* scope cloud z-indices to within this layer */
    }

    .cloud {
        position: absolute;
        overflow: visible; /* ellipses can rise above the viewBox top edge */
        fill: color-mix(in srgb, #DDD var(--white-mix), var(--sky-color));
        animation-name: drift;
        animation-timing-function: linear;
        animation-iteration-count: 1;
        animation-fill-mode: forwards; /* hold at left:100% until JS removes the element */
    }

    @keyframes drift {
        /* Single-property animation — no left+transform desync possible.
           left:-100% places the cloud's left edge at -container_width; since all
           cloud widths are < container_width in landscape, the cloud is fully hidden. */
        from { left: -100%; }
        to   { left:  100%; }
    }
</style>