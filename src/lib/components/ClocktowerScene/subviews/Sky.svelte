<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import { parseCssColor } from "$lib/common/util";
    import { getSceneSkyColor, getSceneAmbientColor, getSceneSkyBrightness, getSceneSunColor } from "../sceneColors";

    let {
        smoothProgress
    }: {
        smoothProgress: number;
    } = $props();

    // A big backdrop, far behind everything else. Orthographic projection
    // means world-space size needed to cover the screen doesn't change with
    // depth, so a single generous fixed size comfortably covers any zoom
    // level the scene is likely to use.
    const SKY_SIZE = 400;
    const SKY_Z = -60;
    const STAR_Z = -55;

    // A small vertical-gradient canvas, redrawn whenever the sky color
    // changes and re-uploaded via `needsUpdate` - the standard three.js
    // pattern for a texture whose pixels change after creation, since simply
    // reassigning `map` to a new texture object doesn't recompile the
    // material's shader once it already has one bound.
    const GRADIENT_HEIGHT = 256;
    let canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = GRADIENT_HEIGHT;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    function mixColor(
        rgb: { r: number; g: number; b: number },
        toward: { r: number; g: number; b: number },
        amount: number
    ) {
        return {
            r: Math.round(rgb.r * (1 - amount) + toward.r * amount),
            g: Math.round(rgb.g * (1 - amount) + toward.g * amount),
            b: Math.round(rgb.b * (1 - amount) + toward.b * amount)
        };
    }

    const NIGHT = { r: 6, g: 8, b: 20 };
    const HAZE = { r: 225, g: 224, b: 216 };

    function rgbStr(rgb: { r: number; g: number; b: number }) {
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    const skyBrightness = $derived(getSceneSkyBrightness(smoothProgress));

    // A floor of ambient light, independent of the sun, standing in for
    // global illumination - bounced/scattered skylight that keeps things
    // dimly visible even with no direct light hitting them (real night scenes
    // are never fully unlit; starlight and sky glow alone provide some fill).
    const GI_FLOOR = 7;
    // Its own color curve (see getSceneAmbientColor), not the sky gradient's
    // - they agree by day but diverge toward night, where the sky can fade
    // toward near-black but the ambient fill still needs to read as a
    // plausible (paler, cooler) moonlit tone to keep shadowed detail visible.
    const ambientColorRgb = $derived(getSceneAmbientColor(smoothProgress));
    // Same fade-in curve the moon itself uses, so the ambient fill brightens
    // in step with it rather than just sitting at a flat night-time floor -
    // boosted well beyond the daytime contribution so unlit/shadowed detail
    // (normal-mapped relief with nothing directly lighting it) still reads
    // clearly once the sun's gone down, rather than going nearly flat black.
    const moonAppearAmount = $derived(Math.pow(1 - skyBrightness, 1.4));
    // Overall multiplier on the whole ambient fill (floor, daytime and moonlit contributions alike).
    const AMBIENT_SCALE = 1.5;
    const ambientIntensity = $derived((GI_FLOOR + skyBrightness * 2.2 + moonAppearAmount * 7) * AMBIENT_SCALE);
    const GROUND_COLOR: [number, number, number] = [0.16, 0.14, 0.12];

    $effect(() => {
        const p = Math.min(Math.max(smoothProgress, 0), 1);
        const base = parseCssColor(getSceneSkyColor(smoothProgress));
        // Real skies run deeper and more saturated overhead, and wash out
        // toward a pale, desaturated haze near the horizon where you're
        // looking through far more atmosphere - a wide, non-linear band of
        // it right at the bottom, not a straight top-to-bottom fade.
        let zenith = mixColor(base, NIGHT, 0.5);
        let midSky = mixColor(base, NIGHT, 0.15);
        let haze = mixColor(base, HAZE, 0.55);

        // The sky only has color because something is lighting it. With the
        // sun below the horizon and no other light source in the scene yet,
        // it should go dark rather than sit at a fixed "night blue" - once
        // the moon's back, its light can earn the sky some color again.
        // Same timing as `skyBrightness`, but gamma-lifted so the mid-range
        // (late afternoon into sunset) stays noticeably brighter without
        // moving where the fade starts or how dark true night still gets
        // (0 and 1 are both fixed points of x^0.4).
        const brightness = Math.pow(skyBrightness, 0.4);

        // The haze is lit by whatever's actually lighting the scene: bleed
        // some of the sun's own color into it, more so the warmer/redder the
        // sun currently is (barely noticeable at noon, a real orange wash at
        // sunset) - real horizon glow is quite literally scattered sunlight -
        // and only while the sun is actually up to cast it.
        const sunFromHorizon = Math.abs(p - 0.5) * 2;
        const sunColor = parseCssColor(getSceneSunColor(smoothProgress));
        haze = mixColor(haze, sunColor, (0.12 + sunFromHorizon * 0.4) * brightness);

        // Fading toward NIGHT (a deep blue) rather than flat black - mixing
        // a warm sunset color straight toward black desaturates it into a
        // muddy, dirty brown; fading toward a color instead keeps it looking
        // like dusk rather than soot.
        const darken = (1 - brightness) * 0.9;
        zenith = mixColor(zenith, NIGHT, darken);
        midSky = mixColor(midSky, NIGHT, darken);
        haze = mixColor(haze, NIGHT, darken * 0.8);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const gradient = ctx.createLinearGradient(0, 0, 0, GRADIENT_HEIGHT);
        gradient.addColorStop(0, rgbStr(zenith));
        gradient.addColorStop(0.45, rgbStr(midSky));
        gradient.addColorStop(0.8, rgbStr(base));
        gradient.addColorStop(1, rgbStr(haze));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, GRADIENT_HEIGHT);
        texture.needsUpdate = true;
    });

    // A scattering of stars that only show once the sky has dimmed enough to
    // see them, echoing the blood moon's slow takeover as the countdown ends.
    const STAR_COUNT = 220;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * SKY_SIZE * 0.9;
        starPositions[i * 3 + 1] = Math.random() * SKY_SIZE * 0.6 - SKY_SIZE * 0.05;
        starPositions[i * 3 + 2] = STAR_Z + Math.random() * 4;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));

    const starOpacity = $derived((1 - skyBrightness) * 0.9);
</script>

<!-- Ambient global illumination: a floor of skylight so the tower is never
     fully unlit, plus whatever extra the actual sky brightness adds by day. -->
<T.HemisphereLight
    position={[0, 1, 0]}
    intensity={ambientIntensity}
    color={new THREE.Color().setRGB(
        ambientColorRgb.r / 255,
        ambientColorRgb.g / 255,
        ambientColorRgb.b / 255,
        THREE.SRGBColorSpace
    )}
    groundColor={new THREE.Color().setRGB(...GROUND_COLOR, THREE.SRGBColorSpace)}
/>

<T.Mesh position={[0, 0, SKY_Z]}>
    <T.PlaneGeometry args={[SKY_SIZE, SKY_SIZE]} />
    <T.MeshBasicMaterial map={texture} depthWrite={false} />
</T.Mesh>

<T.Points geometry={starGeometry}>
    <T.PointsMaterial
        color="#ffffff"
        size={0.6}
        sizeAttenuation={false}
        transparent
        opacity={starOpacity}
        depthWrite={false}
    />
</T.Points>
