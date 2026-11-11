<script lang="ts">
    import { page } from '$app/state';
    import QRCode from 'qrcode';

    // A small QR code in a channel strip, e.g. so a phone can scan its way to a clock's remote from the mixer.
    let {
        /** Path (or URL) on the current host to point the QR code at. */
        path,
        title = undefined,
        /** A short caption inside the tile, under the code. */
        label = undefined,
        /** When on, tapping the tile opens the path on this device, with a backUrl to come back to this page. */
        link = false
    }: {
        path: string;
        title?: string;
        label?: string;
        link?: boolean;
    } = $props();

    const url = $derived(new URL(path, page.url.origin).href);

    // The QR itself stays a clean link for other devices; only this device's tap gets the way back
    const href = $derived.by(() => {
        const target = new URL(path, page.url.origin);
        target.searchParams.set('backUrl', page.url.pathname + page.url.search);
        return target.pathname + target.search;
    });

    let dataUrl = $state('');

    $effect(() => {
        const target = url;
        QRCode.toDataURL(target, { margin: 1, width: 256, errorCorrectionLevel: 'M', color: { dark: '#354a39', light: '#00000000' } })
            .then((src) => { if (target === url) dataUrl = src; })
            .catch((e) => console.warn('Could not make the channel strip QR code', e));
    });
</script>

<svelte:element this={link ? 'a' : 'div'} class="channel-strip-qr" title={title ?? url} href={link ? href : undefined}>
    {#if dataUrl}
        <img src={dataUrl} alt="QR code linking to {url}" />
    {/if}
    {#if label}
        <div class="channel-strip-qr-label">{label}</div>
    {/if}
</svelte:element>

<style>
    .channel-strip-qr {
        width: 100%;
        margin-bottom: 5px;
        padding: 3px;
        box-sizing: border-box;
        /* Styled like the strip's title (AudioMixerText): the modules are a darker shade of its text colour (for contrast), and the transparent
           background shows the strip's accent through. */
        background-color: var(--theme-slider-accent);
        border-radius: 3px;
        box-shadow: 0px 2px 8px 0px #0009 inset;
        border: 3px solid var(--theme-slider-trim);
        display: block;
        text-decoration: none;
    }

    a.channel-strip-qr {
        cursor: pointer;
    }

    .channel-strip-qr img {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        image-rendering: pixelated;
    }

    /* The title's lettering, small */
    .channel-strip-qr-label {
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        font-size: 0.7em;
        line-height: 1;
        color: #354a39;
        text-align: center;
    }
</style>
