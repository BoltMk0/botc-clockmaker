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
    <div class="share-backdrop" role="dialog" tabindex="-1" onclick={() => open = false}>
        <div class="share-card" role="presentation" onclick={(e) => e.stopPropagation()}>
            <div class="share-header">
                <div>
                    <h3 class="share-title">{title}</h3>
                    <div class="share-subtitle">Scan with a phone's camera, or send the link</div>
                </div>
                <button class="share-close" onclick={() => open = false} aria-label="Close">✕</button>
            </div>
            <div class="share-qr-tile">
                {#if error}
                    <p class="share-error">Could not make the QR code: {error}</p>
                {:else if dataUrl}
                    <img class="share-qr" src={dataUrl} alt="QR code linking to {url}" />
                {/if}
            </div>
            <div class="share-link-row">
                <a class="share-link" href={url} title={url}>{url.replace(/^https?:\/\//, '')}</a>
                <button class="share-copy" class:copied onclick={copy}>
                    {#if copied}
                        <svg width={16} height={16} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;"><path d="M5 12l5 5 9-10" /></svg>
                        Copied
                    {:else}
                        <svg width={16} height={16} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round;"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
                        Copy
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .share-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--theme-on-bg);
        opacity: 0.8;
        cursor: pointer;
    }

    .share-button:hover {
        background: rgba(255, 255, 255, 0.08);
        opacity: 1;
    }

    .share-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(3px);
        animation: fade-in 0.15s ease-out;
    }

    .share-card {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: min(100%, 360px);
        padding: 18px;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        background: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        animation: pop-in 0.2s ease-out;
    }

    .share-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .share-title {
        margin: 0;
        font-size: 1.05em;
        font-weight: 600;
    }

    .share-subtitle {
        margin-top: 2px;
        font-size: 0.75em;
        opacity: 0.6;
    }

    .share-close {
        flex: none;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
    }

    .share-close:hover {
        background: rgba(255, 255, 255, 0.16);
    }

    .share-qr-tile {
        align-self: center;
        width: 100%;
        max-width: 260px;
        aspect-ratio: 1;
        padding: 12px;
        box-sizing: border-box;
        border-radius: 12px;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .share-qr {
        display: block;
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
    }

    .share-link-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 4px 4px 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
    }

    .share-link {
        flex: 1;
        min-width: 0;
        font-size: 0.8em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: inherit;
        opacity: 0.85;
        text-decoration: none;
    }

    .share-link:hover {
        text-decoration: underline;
    }

    .share-copy {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        border: none;
        border-radius: 999px;
        background: #f2f2f2;
        color: #1c1c1c;
        font: inherit;
        font-size: 0.8em;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }

    .share-copy.copied {
        background: #8c8;
    }

    .share-error {
        margin: 0;
        color: #c0392b;
        font-size: 0.85em;
        text-align: center;
    }

    @keyframes fade-in {
        from { opacity: 0; }
    }

    @keyframes pop-in {
        from { transform: scale(0.96) translateY(8px); opacity: 0; }
    }
</style>
