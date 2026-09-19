<script lang="ts">
    import TokenBackground from "./TokenBackground.svelte";

    let {
        playerName,
        isDead = false,
        style = '',
        size = '200px',
    }: {
        playerName: string;
        isDead?: boolean;
        style?: string;
        size?: string;
    } = $props();
</script>

<div style="position: absolute; {style}">
    <div style="position:relative; width: {size}; height: {size};">
        <TokenBackground {size}>
            <div class="player-token-content" class:dead={isDead} style="--token-size: {size};">
                <div class="player-name dumbledore-font">{playerName || '?'}</div>
            </div>
        </TokenBackground>
        {#if isDead}
            <div class="token-shroud" style="width: {size}; height: {size};"></div>
        {/if}
    </div>
</div>

<style>
    .player-token-content {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        height: var(--token-size);
        width: var(--token-size);
        box-sizing: border-box;
        padding: 0 8%;
        color: black;
    }

    .player-token-content.dead {
        color: #333;
    }

    .player-name {
        font-size: calc(var(--token-size) / 7);
        font-weight: bold;
        line-height: 1.15;
        overflow-wrap: break-word;
        word-break: break-word;
    }

    .token-shroud {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        border-radius: 50%;
        background:
            radial-gradient(ellipse at 50% 30%, rgba(10, 10, 15, 0.75) 35%, rgba(10, 10, 15, 0.25) 70%, rgba(10, 10, 15, 0) 100%);
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.85);
    }
</style>
