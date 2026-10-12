<script lang="ts">
    import { page } from '$app/state';
    import QRCode from 'qrcode';

    interface Props {
        /** Path on the current host to point the QR code at. */
        path?: string;
        /** Rendered width/height of the QR code in rem. */
        size?: number;
        /** Panel title shown above the QR code. */
        title?: string;
        /** Foreground (module) colour, hex. */
        dark?: string;
        /** Background colour, hex. Use '#00000000' for transparent. */
        light?: string;

        style?: string;
    }

    let {
        path = '/feedback',
        size = 8,
        title = 'Send Us A Message',
        dark = '#EEE',
        light = '#444',
        style = '',
    }: Props = $props();

    const url = $derived(new URL(path, page.url.origin).href);

    let dataUrl = $state('');
    let error = $state<string | null>(null);

    $effect(() => {
        const target = url;
        QRCode.toDataURL(target, {
            margin: 1,
            width: Math.round(size * 16),
            errorCorrectionLevel: 'M',
            color: { dark, light }
        })
            .then((src) => {
                dataUrl = src;
                error = null;
            })
            .catch((e) => {
                error = e instanceof Error ? e.message : String(e);
            });
    });
</script>

<div class="feedback-qr" style="background-color: {light}; color: {dark}; font-size: {size / 13}rem; --qr-size: {size}rem; {style}">
    <h2 class="title">{title}</h2>
    {#if error}
        <p class="error">Could not generate QR code: {error}</p>
    {:else if dataUrl}
        <img src={dataUrl} alt="QR code linking to {url}" style="width: {size}rem; height: {size}rem;" />
    {/if}
</div>

<style>
    .feedback-qr {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        width: fit-content;
    }

    .title {
        margin: 0;
        font-weight: 600;
        text-align: center;
        word-break: break-word;
        overflow-wrap: break-word;
        max-width: var(--qr-size);
    }

    .feedback-qr img {
        display: block;
        image-rendering: pixelated;
        border-radius: 4px;
    }

    .error {
        color: #c0392b;
        font-size: 0.85rem;
        max-width: 200px;
        text-align: center;
    }
</style>
