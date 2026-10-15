<script lang="ts">
    import QRCode from 'qrcode';

    // A button that opens a QR code for a link (e.g. to hand a remote to another phone), with the link itself to copy.
    let {
        /** The link to share. */
        url,
        title = 'Share this page',
        style = ''
    }: {
        url: string;
        title?: string;
        style?: string;
    } = $props();

    let open = $state(false);
    let dataUrl = $state('');
    let error = $state<string | null>(null);
    let copied = $state(false);
    let copyTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        if (!open) return;
        const target = url;
        QRCode.toDataURL(target, { margin: 1, width: 512, errorCorrectionLevel: 'M', color: { dark: '#000', light: '#fff' } })
            .then((src) => {
                dataUrl = src;
                error = null;
            })
            .catch((e) => {
                error = e instanceof Error ? e.message : String(e);
            });
    });

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // navigator.clipboard is unavailable outside secure contexts (e.g. plain-http LAN access)
            const input = document.createElement('textarea');
            input.value = url;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            const ok = document.execCommand('copy');
            input.remove();
            if (!ok) return;
        }
        copied = true;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => copied = false, 2000);
    }
</script>

<button class="share-button" onclick={() => open = true} aria-label={title} title={title} {style}>
    <!-- A QR code: three finder squares and a few modules -->
    <svg width={26} height={26} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round;">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20v1M20 14v1" style="fill: currentColor; stroke-width: 1.5;" />
    </svg>
</button>

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="share-overlay" role="dialog" tabindex="-1" onclick={() => open = false}>
        <div class="share-panel" role="presentation" onclick={(e) => e.stopPropagation()}>
            <button class="share-close" onclick={() => open = false} aria-label="Close">✕</button>
            <h3 class="share-title">{title}</h3>
            {#if error}
                <p class="share-error">Could not make the QR code: {error}</p>
            {:else if dataUrl}
                <img class="share-qr" src={dataUrl} alt="QR code linking to {url}" />
            {/if}
            <div class="share-link-row">
                <a class="share-link" href={url}>{url}</a>
                <button class="button-style share-copy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .share-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border: none;
        background: none;
        color: var(--theme-on-bg);
        opacity: 0.8;
        cursor: pointer;
    }

    .share-button:hover {
        opacity: 1;
    }

    .share-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
        background-color: rgba(0, 0, 0, 0.75);
    }

    .share-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        width: min(100%, 360px);
        padding: 20px;
        box-sizing: border-box;
        border-radius: 8px;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
    }

    .share-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 1.25rem;
        line-height: 1;
    }

    .share-title {
        margin: 0 40px;
        font-weight: normal;
        text-align: center;
    }

    .share-qr {
        display: block;
        width: 100%;
        max-width: 280px;
        aspect-ratio: 1;
        image-rendering: pixelated;
        border-radius: 4px;
    }

    .share-link-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .share-link {
        flex: 1;
        min-width: 0;
        font-size: small;
        overflow-wrap: anywhere;
        color: inherit;
    }

    .share-copy {
        flex-shrink: 0;
        min-width: 5em;
    }

    .share-error {
        color: var(--theme-error);
        text-align: center;
    }
</style>
