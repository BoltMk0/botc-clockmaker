<script lang="ts">
    import { fetchScriptWithSideCharacters } from "$lib/resources/client/scriptWithSideCharacters";
    import * as THREE from "three";
    import { fade } from "svelte/transition";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { Canvas } from "@threlte/core";
    import Scene from "./Scene.svelte";
    import { isGrimoireStateHistory, type GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";
    import { isQrCode, type QrCode } from "$lib/resources/common/qrCodes";
    import { appSettings } from "$lib/model/client/appSettings.svelte";
    import clocktowerColor from "$lib/assets/clocktower-scene/clocktower-color.png";
    import clocktowerNormal from "$lib/assets/clocktower-scene/clocktower-normal.png";
    import clockfaceColor from "$lib/assets/clocktower-scene/clockface-color.png";
    import clockfaceNormal from "$lib/assets/clocktower-scene/clockface-normal.png";
    // The rest of the scene's static image assets, pulled in here purely so
    // they can be preloaded up front - see `assetsReady` below. Each is still
    // separately imported (and actually turned into a texture) by its own
    // subview; importing the same URL twice just resolves to the same
    // already-bundled asset, not a second copy.
    import lanternTextureUrl from "$lib/assets/clocktower-scene/lantern.png";
    import lanternNormalMapUrl from "$lib/assets/clocktower-scene/lantern-normal.png";
    import minuteHandUrl from "$lib/assets/clockhand.png";
    import hourHandUrl from "$lib/assets/clockhand3.png";
    import moonTextureUrl from "$lib/assets/clocktower-scene/moon-texture.png";
    import countBannerTextureUrl from "$lib/assets/clocktower-scene/billboard.png";
    import countBannerNormalMapUrl from "$lib/assets/clocktower-scene/billboard_normal.png";
    import smallBannerTextureUrl from "$lib/assets/clocktower-scene/BannerSmall.png";
    import dayBannerTextureUrl from "$lib/assets/clocktower-scene/banner_large_2.png";
    import dayBannerNormalMapUrl from "$lib/assets/clocktower-scene/banner_large_2_normal.png";

    let {
        progress,
        // Countdown length in seconds - drives how fast the clock hands
        // sweep (they tick once per real minute of countdown, same as the
        // 2D clocktower display), independent of `progress` alone.
        totalTime = 60,
        dayNumber = 1,
        playerCount = 0,
        imageUrl = clocktowerColor,
        normalMapUrl = clocktowerNormal,
        clockFaceImageUrl = clockfaceColor,
        clockFaceNormalMapUrl = clockfaceNormal,
        // Normalized (0-1) position of the clock's center within the image,
        // (0,0) = top-left, (1,1) = bottom-right. This point is always kept
        // centered on screen and is what the camera stays focused on as the
        // image is cropped/zoomed. Placeholder art estimate - retune once the
        // final asset is in.
        origin = { x: 0.499, y: 0.506 },
        // How much of the image's vertical extent is visible on screen: a
        // fraction of `planeHeight`. Smaller = more cropped/zoomed in.
        visibleHeight = 5,
        // World-space height the full image is scaled to. Only matters
        // relative to visibleHeight/sun tuning; the default of 10 is arbitrary.
        planeHeight = 10,
        // Scaled off the visible crop (not the full image scale) so the sun
        // actually stays on screen through its arc, the same fix the moon
        // needed - `planeHeight` is the wrong unit here since it can be much
        // larger than what's actually in view.
        sunArcRadius = visibleHeight * 0.35,
        // Raised and brought in a bit from the earlier low, distant angle:
        // steeper incidence means the flat facade catches less flat/frontal
        // light while the normal map's carved relief picks up stronger
        // highlights and shadows, without the tower going unlit (the ambient
        // fill in Sky.svelte covers that).
        sunHeight = visibleHeight * 0.15,
        sunForwardDistance = planeHeight * 0.6,
        // Pushes the tower (and the moon, which stays anchored to it) off
        // dead-center - the screen is thought of as 5 equal vertical
        // strips, with the tower centered in strip 4 (leaving 2 and 3 free
        // for UI/text), leaving the sun's own full-width arc and the camera
        // framing untouched. Strip 4 of 5 spans 60%-80% of the width, so its
        // center sits 20% of the full width right of dead-center.
        horizontalOffset = visibleHeight * 0.4,
        // Lifts the tower (clockface/hands riding along with it) off dead-
        // center vertically, same idea as `horizontalOffset` but on the Y
        // axis - a fraction of `visibleHeight`, +up.
        verticalOffset = visibleHeight * 0.07,
        // How much of the screen's vertical extent the mist layer covers, as
        // a fraction of `visibleHeight` - see Mist.svelte's `heightFraction`.
        mistHeightFraction = 0.4,
        showOriginMarker = false,
        style = "",
        // The clock this scene belongs to - used to poll whether a virtual
        // grimoire exists for it and, if so, to render its seated players'
        // tokens (see below).
        clockId
    }: {
        progress: number;
        totalTime?: number;
        dayNumber?: number;
        playerCount?: number;
        imageUrl?: string;
        normalMapUrl?: string;
        clockFaceImageUrl?: string;
        clockFaceNormalMapUrl?: string;
        origin?: { x: number; y: number };
        visibleHeight?: number;
        planeHeight?: number;
        sunArcRadius?: number;
        sunHeight?: number;
        sunForwardDistance?: number;
        horizontalOffset?: number;
        verticalOffset?: number;
        mistHeightFraction?: number;
        showOriginMarker?: boolean;
        style?: string;
        clockId: string;
    } = $props();

    // The scene's various subviews each load their own textures independently
    // (useTexture calls scattered across Tower/ClockFace/TextBanner/
    // PlayerCountBanner/Lantern/Moon/ClockHands/SmallBanner), so there's no
    // single built-in "everything's ready" signal, and no easy way to plumb
    // one up from inside the Threlte tree without touching every one of
    // those files. Preloading every static image asset here instead - fully
    // decoded, not just fetched - means each subview's own `useTexture` call
    // resolves against an already-decoded, already-cached image, so they all
    // pop in on the same frame instead of one at a time as each request
    // trickles in. `imageUrl`/`normalMapUrl`/`clockFaceImageUrl`/
    // `clockFaceNormalMapUrl` (tower/clockface art) can be overridden per
    // clock, so they're preloaded separately below; everything else is a
    // fixed static import.
    const staticImageUrls = [
        lanternTextureUrl,
        lanternNormalMapUrl,
        minuteHandUrl,
        hourHandUrl,
        moonTextureUrl,
        countBannerTextureUrl,
        countBannerNormalMapUrl,
        smallBannerTextureUrl,
        dayBannerTextureUrl,
        dayBannerNormalMapUrl
    ];

    // Dev-only: lets whoever's tuning the scene's colors drag through the
    // whole day/night cycle instantly instead of waiting on (or faking) a
    // real countdown. Never shown in production - see the `{#if DEV}` below.
    let debugProgressOverride = $state<number | null>(null);
    const effectiveProgress = $derived(debugProgressOverride ?? progress);

    let assetsReady = $state(false);

    $effect(() => {
        if (!browser) return;

        function preloadImage(url: string) {
            return new Promise<void>((resolve) => {
                const img = new Image();
                const done = () => {
                    // decode() (where available) waits for the image to be
                    // fully decoded, not just downloaded, so the texture
                    // upload/first draw doesn't stall on decode work later.
                    if (img.decode) {
                        img.decode().then(resolve, resolve);
                    } else {
                        resolve();
                    }
                };
                img.onload = done;
                // Resolve on error too, rather than blocking the scene
                // forever on one bad/missing asset.
                img.onerror = () => resolve();
                img.src = url;
            });
        }

        let cancelled = false;
        Promise.all([
            preloadImage(imageUrl),
            preloadImage(normalMapUrl),
            preloadImage(clockFaceImageUrl),
            preloadImage(clockFaceNormalMapUrl),
            ...staticImageUrls.map(preloadImage),
            document.fonts.load('400 16px "Dumbledore"').catch(() => {})
        ]).then(() => {
            if (!cancelled) assetsReady = true;
        });

        return () => {
            cancelled = true;
        };
    });

    // Whether a grim exists for this clock, and (if so) its live state -
    // some tables run without a virtual grimoire, so this is polled rather
    // than assumed, and passed down to Scene/GameStatsPanel, which uses it
    // both to pick its layout (see `hasGrim`) and to render the seated
    // players' tokens when a grim exists - one fetch here serves both.
    let grimoireState = $state<GrimoireStateHistory | null>(null);
    let script = $state<ScriptWithCharacters | null>(null);
    const hasGrim = $derived(grimoireState !== null);

    onMount(() => {
        if (!browser) return;

        let cancelled = false;
        let lastScriptId: string | null = null;

        async function poll() {
            try {
                const res = await fetch(`/admin/${clockId}/grim/state`);
                if (cancelled) return;
                if (!res.ok) {
                    grimoireState = null;
                    return;
                }
                const body = await res.json();
                if (!isGrimoireStateHistory(body)) return;
                grimoireState = body;

                if (body.scriptId !== lastScriptId) {
                    lastScriptId = body.scriptId;
                    if (body.scriptId) {
                        const fetched = await fetchScriptWithSideCharacters(body.scriptId);
                        if (!cancelled && fetched) {
                            script = fetched;
                        }
                    } else {
                        script = null;
                    }
                }
            } catch {
                // Ignore transient fetch failures; we'll just try again next tick.
            }
        }

        poll();
        const interval = setInterval(poll, 2000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    });

    // The configured QR codes (global, not per-clock - see /api/qrCodes),
    // rendered as scene objects behind the player seat tokens instead of the
    // DOM overlay used by the other display modes - see SceneQrCodes.svelte.
    // Fetched once; this list changes rarely enough that polling isn't worth it.
    let qrCodes = $state<QrCode[]>([]);
    onMount(() => {
        if (!browser) return;
        fetch('/api/qrCodes')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((d) => {
                if (Array.isArray(d) && d.every(isQrCode)) qrCodes = d;
            })
            .catch(() => {});
    });
    const shownQrCodes = $derived(appSettings.showQRCodes ? qrCodes : []);

</script>

<div style="position: relative; width: 100%; height: 100%; {style}">
    {#if browser}
        <!-- Mounted regardless of `assetsReady` so the scene starts loading
             its own textures (each subview's own useTexture call) and
             rendering behind the overlay right away, rather than waiting for
             it to be hidden first - the overlay above it is what actually
             hides any one-at-a-time pop-in from the viewer. -->
        <Canvas
            createRenderer={(canvas) => {
                const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
                renderer.setClearColor(0x000000, 0);
                return renderer;
            }}
            toneMapping={THREE.NoToneMapping}
        >
            <Scene
                progress={effectiveProgress}
                {totalTime}
                {dayNumber}
                {playerCount}
                {imageUrl}
                {normalMapUrl}
                {clockFaceImageUrl}
                {clockFaceNormalMapUrl}
                {origin}
                {visibleHeight}
                {planeHeight}
                {sunArcRadius}
                {sunHeight}
                {sunForwardDistance}
                {horizontalOffset}
                {verticalOffset}
                {mistHeightFraction}
                {showOriginMarker}
                {hasGrim}
                {grimoireState}
                {script}
                qrCodes={shownQrCodes}
            />
        </Canvas>
        {#if !assetsReady}
            <div class="loading-overlay" out:fade={{ duration: 400 }}>
                <div class="spinner"></div>
                <div class="loading-text dumbledore-font">Loading...</div>
            </div>
        {/if}
        {#if import.meta.env.DEV}
            <div class="debug-progress">
                <span>day progress</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.001"
                    value={effectiveProgress}
                    oninput={(e) => (debugProgressOverride = parseFloat((e.target as HTMLInputElement).value))}
                />
                <span>{effectiveProgress.toFixed(3)}</span>
                <button
                    type="button"
                    disabled={debugProgressOverride === null}
                    onclick={() => (debugProgressOverride = null)}
                >live</button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75em;
        background: #000;
    }

    .spinner {
        width: 2.5em;
        height: 2.5em;
        border-radius: 50%;
        border: 0.25em solid #ffffff30;
        border-top-color: #c9c2a3;
        animation: spin 0.9s linear infinite;
    }

    .loading-text {
        color: #c9c2a3;
        font-size: 1.3em;
        text-shadow: 0 2px 4px #0008;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .debug-progress {
        position: absolute;
        left: 50%;
        bottom: 0.75em;
        transform: translateX(-50%);
        z-index: 30;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.4em 0.8em;
        border-radius: 999px;
        background: #000a;
        color: #c9c2a3;
        font-family: monospace;
        font-size: 0.85em;
        white-space: nowrap;
    }

    .debug-progress input[type="range"] {
        width: 40vw;
        max-width: 24em;
    }

    .debug-progress button {
        font: inherit;
        color: inherit;
        background: #ffffff20;
        border: 1px solid #ffffff40;
        border-radius: 999px;
        padding: 0.15em 0.7em;
        cursor: pointer;
    }

    .debug-progress button:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
