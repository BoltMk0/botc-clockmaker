<script lang="ts">
    import minuteHand from '$lib/assets/clockhand.png';
    import hourHand from '$lib/assets/clockhand3.png';
    import { getNewClocktowerThemeContext } from '$lib/components/FullDisplay/NewClocktowerDisplay/model/theme';

    let {
        style = '',
        minuteHandProgress = undefined,
        hourHandProgress = undefined,
        majorTickls = 12,
        minorTickls = 60,
        numerals = false,
    }: {
        style?: string;
        minuteHandProgress?: number;
        hourHandProgress?: number;
        majorTickls?: number;
        minorTickls?: number;
        numerals?: boolean;
    } = $props()


    const theme = getNewClocktowerThemeContext();
</script>

<style>
    .clockface-main {
        position: relative;
        width: 100%;
        aspect-ratio: 1/1;
        border-radius: 50%;
        border: 3px solid var(--border-color);
        box-sizing: border-box;
        transition: border-color 1s;
    }

    .clockface-main > * {
        position: absolute;
    }

    .clockhand {
        position: absolute;
        top: 50%;
        left: 50%;
        transform-origin: 6.5% center;
        pointer-events: none;
        max-width: 50%;
        max-height: 50%;
        aspect-ratio: 1/1;
        height: 100%;
        width: 100%;
        object-fit: contain;
        transition: transform 0.5s ease;
    }

    .clockhand.minute {
        transform-origin: 7% center;
    }

    .clockhand.hour {
        transform-origin: 6.5% center;
    }

    .tick-container {
        height: 50%;
        left: 50%;
        transform-origin: bottom;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    .tick {
        transition: background-color 1s;
        background-color: var(--border-color);
    }

    .tick.major {
        width: 7px;
        height: 14px;
    }

    .tick.minor {
        width: 1.5px;
        height: 14px;
    }

    .numerals {
        font-family:'Times New Roman', Times, serif;
        font-weight: lighter;
        text-shadow: 0 2px 4px #0005;
        /* text-shadow: 0 0 3px rgba(0, 0, 0, 0.5); */
        transition: color 1s;
        font-size: 2em;
        margin-top: -5px;
    }

</style>


<div class="clockface-main" style="--border-color: {theme.clockfaceTextColor}; {style}">
    {#if minorTickls !== undefined}
    {#each {length: minorTickls} as _, i}
        <div class="tick-container" style="transform: translateX(-50%) rotate({360*(i+1)/minorTickls}deg);">
            <div class="tick minor"></div>
        </div>
    {/each}
    {/if}
    {#if majorTickls !== undefined}
    {#each {length: majorTickls} as _, i}
        <div class="tick-container" style="transform: translateX(-50%) rotate({360*(i+1)/majorTickls}deg); color: {theme.clockfaceTextColor}">
            <div class="tick major"></div>
            {#if numerals}
            <div class="numerals" style="transform: rotate(-{360*(i+1)/majorTickls}deg);">{String.fromCharCode(8544+i)}</div>
            {/if}
        </div>
    {/each}
    {/if}

    {#if minuteHandProgress !== undefined}
    <img src="{minuteHand}" class="clockhand minute" style="transform: translate(-7%, -50%) rotate({-90 + minuteHandProgress * 360}deg);" alt="minute hand"/>
    {/if}

    {#if hourHandProgress !== undefined}
    <img src="{hourHand}" class="clockhand hour" style="transform: translate(-6.5%, -50%) rotate({-90 + hourHandProgress * 360}deg);" alt="hour hand"/>
    {/if}
    <div style="width: 10%; height: 10%; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: black; position: absolute; box-shadow: 0 0 50px black; border: 3px solid var(--border-color)"></div>
</div>