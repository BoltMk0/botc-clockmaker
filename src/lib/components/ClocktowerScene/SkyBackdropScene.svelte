<script lang="ts">
    import { useThrelte } from "@threlte/core";
    import OrthoCamera from "./subviews/OrthoCamera.svelte";
    import Sky from "./subviews/Sky.svelte";
    import Clouds from "./subviews/Clouds.svelte";
    import Sun from "./subviews/Sun.svelte";
    import Mist from "./subviews/Mist.svelte";

    let {
        progress,
        visibleHeight
    }: {
        progress: number;
        visibleHeight: number;
    } = $props();

    // Same sun tuning as ClocktowerScene's defaults, except the arc is also
    // capped by the screen's width so the sun stays in frame on narrow
    // (portrait/phone) screens rather than sitting off the left edge.
    const { size } = useThrelte();
    const halfWidth = $derived(visibleHeight * ($size.width / $size.height) / 2);
    const sunArcRadius = $derived(Math.min(visibleHeight * 0.35, halfWidth * 0.8));
</script>

<OrthoCamera {visibleHeight} />
<Sky smoothProgress={progress} />
<Clouds smoothProgress={progress} {visibleHeight} horizontalOffset={0} />
<Sun smoothProgress={progress} arcRadius={sunArcRadius} height={visibleHeight * 0.15} forwardDistance={10 * 0.6} />
<Mist smoothProgress={progress} {visibleHeight} heightFraction={0.4} />
