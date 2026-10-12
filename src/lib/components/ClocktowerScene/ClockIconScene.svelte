<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import OrthoCamera from "./subviews/OrthoCamera.svelte";
    import ClockFace from "./subviews/ClockFace.svelte";
    import ClockHands from "./subviews/ClockHands.svelte";
    import { getSceneAmbientColor, getSceneSkyBrightness, getSceneSunColor } from "./sceneColors";
    import { parseCssColor } from "$lib/common/util";
    import clockfaceColor from "$lib/assets/clocktower-scene/clockface-color.png";
    import clockfaceNormal from "$lib/assets/clocktower-scene/clockface-normal.png";

    let {
        progress,
        minuteHandProgress,
        hourHandProgress
    }: {
        progress: number;
        minuteHandProgress: number;
        hourHandProgress: number;
    } = $props();

    // ClockFace/ClockHands size themselves against the tower art (3200px tall
    // for `towerPlaneHeight` world units). The dial art is 400px, so this makes
    // the dial exactly 1 world unit across, and the camera frames just that.
    const TOWER_PLANE_HEIGHT = 3200 / 400;
    const VISIBLE_HEIGHT = 1;

    // Stand-ins for the full scene's sky fill and sun (see Sky.svelte and
    // Sun.svelte), without their backdrop meshes: light that follows the time
    // of day, dimming at night so the dial's red glow takes over.
    const skyBrightness = $derived(getSceneSkyBrightness(progress));
    const ambientRgb = $derived(getSceneAmbientColor(progress));
    const ambientIntensity = $derived(7 + skyBrightness * 2.2 + Math.pow(1 - skyBrightness, 1.4) * 7);
    const sunRgb = $derived(parseCssColor(getSceneSunColor(progress)));

    function toThreeColor(rgb: { r: number; g: number; b: number }) {
        return new THREE.Color().setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    }
</script>

<OrthoCamera visibleHeight={VISIBLE_HEIGHT} />

<T.HemisphereLight
    position={[0, 1, 0]}
    intensity={ambientIntensity}
    color={toThreeColor(ambientRgb)}
    groundColor={new THREE.Color().setRGB(0.16, 0.14, 0.12, THREE.SRGBColorSpace)}
/>
<T.DirectionalLight position={[-1, 1.5, 2]} intensity={skyBrightness * 5} color={toThreeColor(sunRgb)} />

<ClockFace
    imageUrl={clockfaceColor}
    normalMapUrl={clockfaceNormal}
    towerPlaneHeight={TOWER_PLANE_HEIGHT}
    horizontalOffset={0}
    smoothProgress={progress}
    halo={false}
/>
<ClockHands {minuteHandProgress} {hourHandProgress} towerPlaneHeight={TOWER_PLANE_HEIGHT} horizontalOffset={0} />
