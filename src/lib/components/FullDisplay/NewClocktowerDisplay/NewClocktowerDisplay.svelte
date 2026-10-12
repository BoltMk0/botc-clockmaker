<script lang="ts">
    import { getSkyColor, tintByAmbient } from "$lib/common/util";
    import { appSettings } from "$lib/model/client/appSettings.svelte";
    import CountdownDisplay from "./subviews/NewClockFace/CountdownDisplay.svelte";
    import NewClockFace from "./subviews/NewClockFace/NewClockFace.svelte";
    import PlayerCountDisplay from "./subviews/NewClockFace/PlayerCountDisplay.svelte";
    import Bunting from "./subviews/ClocktowerSillhouette/Bunting/Bunting.svelte";
    import ClocktowerSillhouette from "./subviews/ClocktowerSillhouette/ClocktowerSillhouette.svelte";
    import Clouds from "./Clouds.svelte";
    import { setNewClocktowerThemeContext } from "./model/theme";

    let {
        totalTime = 60,
        progress,
        hue = 200,
        dayNumber = 0,
        playerCount = 0,
        style = ""
    }: {
        totalTime: number;
        progress: number;
        hue: number;
        dayNumber: number;
        playerCount: number;
        style: string;
    } = $props();

    const timeRemaining = $derived((1-progress) * totalTime);

    const skyColor = $derived(getSkyColor(progress));
    const skyBrightness = $derived(Math.pow(1 - (Math.max(0, progress*3 - 2)), 2));


    const basePrimary = $derived(tintByAmbient('#29251C', skyColor, 0.4));
    const baseSecondary = $derived(`color-mix(in srgb, hsl(from ${basePrimary} h calc(s*0.7) calc(l*1.3)), ${skyColor} 10%)`);

    const clockfaceColorSecondary = $derived(tintByAmbient(`hsl(${hue} 0% 20%)`, skyColor, 0.4));
    const clockfaceColorPrimary = $derived(`hsl(${hue} ${(skyBrightness * 0.15 + 0.75) * 50}% ${(skyBrightness*0.35 + 0.45) * 50}%)`);
    const buntingColorBase = $derived(tintByAmbient(clockfaceColorPrimary, skyColor, 0.3));

    const theme = setNewClocktowerThemeContext({
        get basePrimary(){ return basePrimary},
        get baseSecondary(){return baseSecondary},
        get clockfaceColorPrimary(){return `hsl(from ${skyColor} h calc(s*0.5) calc(l*0.85))`},
        get clockfaceColorSecondary(){return clockfaceColorSecondary},
        get clockfaceColorHighlight(){return skyColor},
        get clockfaceTextColor() { return `hsl(0 0 ${(skyBrightness*0.15 + 0.2)*80}%)` },
        get panelColorPrimary(){return baseSecondary},
        get panelColorSecondary(){return clockfaceColorPrimary},
        get panelTextColor(){ return `hsl(0 0 ${(skyBrightness*0.1 + 0.9)*90}%)`},
        get buntingColorBase() {return buntingColorBase},
        get skyColor(){ return skyColor },
        get skyBrightness() {return skyBrightness }
    });

    const BUNTING_DENSITY = 0.6;
    const BUNTING_OPACITY = 0.8;
    const BUNTING_HEIGHT_RATIO = 1/16;

    const BUNTING_ROTATION_BASE = 7;
    const BUNTIN_ROTATION_RANGE = 1;

    const fontSizePx = $derived(appSettings.size/40)
</script>

<style>
    .clocktower-main {
        position: absolute;
        width: 100%;
        height: 100%;
        left: 50%;
        transform: translateX(-50%);
        bottom: 0;
    }   

    .clocktower-main>*{
        position: absolute;
    }
</style>

<div style="position: relative; width: 100%; height: 100%; bottom: 0; font-size: {fontSizePx}px; {style};">

    <Clouds skyColor={getSkyColor(progress)} style="top: 0; height: 45%;"/>

    <Bunting width={"60%"} height={appSettings.size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={-(BUNTING_ROTATION_BASE + Math.random() * BUNTIN_ROTATION_RANGE)} style="position: absolute; top: 77%; left: -10%; transform-origin: 100% 100%; opacity: {BUNTING_OPACITY}"/>
    <Bunting width={"60%"} height={appSettings.size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={-(BUNTING_ROTATION_BASE * 1.5 + Math.random() * BUNTIN_ROTATION_RANGE)} style="position: absolute; top: 33%; left: -10%; transform-origin: 100% 100%; opacity: {BUNTING_OPACITY}"/>

    <Bunting width={"60%"} height={appSettings.size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={BUNTING_ROTATION_BASE + Math.random() * BUNTIN_ROTATION_RANGE} style="position: absolute; top: 76%; right: -10%; transform-origin: 0% 100%; opacity: {BUNTING_OPACITY}"/>
    <Bunting width={"60%"} height={appSettings.size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={BUNTING_ROTATION_BASE * 1.5 + Math.random() * BUNTIN_ROTATION_RANGE} style="position: absolute; top: 34%; right: -10%; transform-origin: 0% 100%; opacity: {BUNTING_OPACITY}"/>

    <div class="clocktower-main" style="width: {appSettings.size}px; height: {appSettings.size*1.5}px;">
        <ClocktowerSillhouette/>
        <div style="top: 48%; width: 56%; left: 50%; transform: translate(-50%, -50%); padding: {appSettings.size/5}px; font-size: 0.8em;">
            <NewClockFace totalTime={totalTime} progress={progress} dayNumber={dayNumber} style="border-radius: 50%; box-sizing: border-box; transition: border 1s; border: 10px solid {theme.panelColorSecondary};"/>
        </div>

        <div style="top: 71%; width: 44%; margin: 0 28%; font-size: 1em;">
            <CountdownDisplay {timeRemaining}/>
        </div>
        <div style="top: 13%; width: 26%; margin: 0 37%; font-size: 0.8em;">
            <PlayerCountDisplay numPlayers={playerCount}/>
        </div>
    </div>
</div>