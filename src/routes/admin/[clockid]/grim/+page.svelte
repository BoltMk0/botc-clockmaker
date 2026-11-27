<script lang="ts">
    import "$lib/components/grim/grimUi.css";
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { ICON_VIEWBOX, addBoxIcon, checkIcon, closeIcon, deleteIcon, keyboardArrowDownIcon, keyboardArrowUpIcon, listAltIcon, refreshIcon, saveIcon, scheduleIcon, smsIcon, sportsScoreIcon, syncIcon, timerIcon, visibilityIcon, warningFillIcon } from "$lib/icons/material.js";
    import { fetchScriptWithSideCharacters } from "$lib/resources/client/scriptWithSideCharacters";
    import { hasNoBlanks, nameFromElements, presetDisplayName, type MessageElement, type MessagePreset, type PresetElement, type TextOption } from "$lib/common/message";
    import { alignmentForCategory, bluffSetsOf, characterMessagePresetsFor, type ScriptCharacter, type ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import InPlayWarning from "$lib/components/InPlayWarning.svelte";
    import MessageBuilder, { type MessageBuilderView } from "$lib/components/MessageBuilder.svelte";
    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';
    import { Clocktower } from "$lib/model/client/Clocktower.svelte.js";
    import { GrimoireSync } from "$lib/model/client/GrimoireSync";
    import { GrimoireUndo } from "$lib/model/client/GrimoireUndo.svelte";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import { onMount, type Snippet } from "svelte";
    import { fly, slide } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { MediaQuery } from "svelte/reactivity";
    import ClockSetter from "$lib/components/ClockSetter.svelte";
    import { BOARD_TOKEN_SIZE, nearestByAngle, remindersBySeatedToken, type Alignment, type GrimoireStateHistory, type PlacedToken } from "$lib/resources/common/grimoireState.js";
    import TrashIcon from "$lib/components/TrashIcon.svelte";
    import { characterImageUrl } from "$lib/resources/common/characterImages";
    import { MessageQueue } from "$lib/model/client/messageQueue.svelte";
    import GrimBoard from "$lib/components/grim/GrimBoard.svelte";
    import { GRIM_Z, GrimModel, TRAY_IMAGE_SIZE, asScriptCharacters, isSideCategory, normaliseHistory } from "$lib/components/grim/GrimModel.svelte";
    import type { PageData } from "./$types";

    // Size of the central clock, as a multiple of the token size
    const CLOCK_SCALE = 1.0;
    const tokenSize = BOARD_TOKEN_SIZE;

    let {data}: {data: PageData} = $props();

    // The board: the tokens, reminders, drawings and token tray (see GrimBoard)
    let board = $state<GrimBoard>();
    // The token whose popup is open on the board, and whether something's being dragged on it
    let activeTokenId = $state<string | null>(null);
    let boardDragging = $state(false);

    // Before the script has loaded, a token with no alignment saved takes its character's, from the library.
    function libraryAlignmentFor(characterId: string | null): Alignment {
        const character = data.characters.find(c => c.id === characterId);
        return character ? alignmentForCategory(character.category) : 'good';
    }

    // svelte-ignore state_referenced_locally
    let gameState = $state(normaliseHistory(browser ? GrimoireSync.initialState(data.clockid, data.grimoireState) : data.grimoireState, libraryAlignmentFor));

    // Keeps this grim in step with the same grim open on other devices (see GrimoireSync).
    // svelte-ignore state_referenced_locally
    const grimSync = new GrimoireSync({
        clockid: data.clockid,
        serverState: data.grimoireState,
        getLocal: () => $state.snapshot(gameState) as GrimoireStateHistory,
        setLocal: (history) => {
            // This device's changes so far are its own to undo; what comes in from others isn't.
            undo.checkpoint();
            const next = normaliseHistory(history, model.defaultAlignmentFor);
            gameState.scriptId = next.scriptId;
            gameState.loadedPreset = next.loadedPreset;
            gameState.saveslots = next.saveslots;
            gameState.present = next.present;
            gameState.revision = next.revision;
            undo.reset();
        },
        isBusy: () => board?.isBusy() ?? false,
        onstatus: (status) => {
            // Changes made since the save began are still to go
            saveStatus = status === 'saved' && board?.hasPendingSave() ? 'unsaved' : status;
        },
        ondeleted: () => {
            board?.cancelPendingSave();
            localStorage.removeItem(`grimoire-state-${data.clockid}`);
            // The grim is always there for the game: reloading opens a new, empty one.
            alert('This game has been ended on another device.');
            location.reload();
        },
        onconflict: (times) => new Promise(resolve => {
            syncConflict = { ...times, resolve };
        })
    });

    // This device's unsynced changes and the server's newer grimoire, waiting for the storyteller to choose one
    let syncConflict = $state<{ local: number; server: number; resolve: (choice: 'local' | 'server') => void } | null>(null);

    function resolveSyncConflict(choice: 'local' | 'server') {
        syncConflict?.resolve(choice);
        syncConflict = null;
    }

    const formatSaveTime = (time: number) => new Date(time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    // Undo for this device's changes: each save is a step (see GrimoireUndo).
    const undo = new GrimoireUndo(() => gameState);

    type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';
    let saveStatus = $state<SaveStatus>('saved');

    // Saves the grim now (as a step to undo), as the board does after each change.
    async function saveGrimoire() {
        if (board) await board.save();
        else await grimSync.save();
    }

    // SCRIPT / PRESET SELECTION
    // The game's script (with every traveller, loric and fabled); null without one (a grim that hasn't been set up).
    let script = $state<ScriptWithCharacters | null>(null);

    $effect(() => {
        const id = gameState.scriptId;
        if (!id) {
            script = null;
            return;
        }
        fetchScriptWithSideCharacters(id).then(s => {
            if (gameState.scriptId !== id) return;
            script = s;
        }).catch(() => { if (gameState.scriptId === id) script = null; });
    });

    // Every character in the library, with their own night order: any of them can be put on the grim from the tray.
    const libraryCharacters = $derived<ScriptCharacter[]>(asScriptCharacters(data.characters));

    const model = new GrimModel({
        grim: () => gameState,
        script: () => script,
        library: () => libraryCharacters,
        scripts: () => data.scripts
    });

    const characterById = $derived(model.characterById);
    const availableCharacters = $derived<Record<string, ScriptCharacter>>(Object.fromEntries(characterById));
    const availableReminderTokens = $derived(model.reminderById);
    const placedTokens = $derived(model.placedTokens);
    const placedReminders = $derived(model.placedReminders);
    const seatedCharacterIdSet = $derived(model.seatedCharacterIdSet);
    const sortedScriptCharacters = $derived(model.sortedScriptCharacters);
    const isInPlay = (characterId: string) => model.isInPlay(characterId);
    const activeToken = $derived<PlacedToken | null>(activeTokenId === null ? null : (placedTokens.find(t => t.id === activeTokenId) ?? null));

    // Phone-width screen
    const mobileQuery = new MediaQuery('(max-width: 768px)', false);
    // As in the token tray: slightly smaller on a phone so more tokens fit per row.
    const trayTokenSize = $derived(Math.max(40, Math.round(tokenSize * 0.53 * (mobileQuery.current ? 0.8 : 1))));

    const loadedPreset = $derived(gameState.loadedPreset);
    const bluffSets = $derived(loadedPreset ? bluffSetsOf(loadedPreset) : []);

    // The bluffs picked so far while adding a new bluff set; null when the picker is closed.
    let newBluffSet = $state<string[] | null>(null);

    function toggleNewBluff(characterId: string) {
        if (!newBluffSet) return;
        if (newBluffSet.includes(characterId)) newBluffSet = newBluffSet.filter(id => id !== characterId);
        else newBluffSet = [...newBluffSet, characterId];
    }

    async function deleteBluffSet(index: number) {
        if (!gameState.loadedPreset || !confirm('Delete this bluff set?')) return;
        gameState.loadedPreset = { ...gameState.loadedPreset, bluff_sets: bluffSets.filter((_, i) => i !== index) };
        await saveGrimoire();
    }

    async function addBluffSet() {
        if (!gameState.loadedPreset || !newBluffSet || newBluffSet.length < 3) return;
        gameState.loadedPreset = { ...gameState.loadedPreset, bluff_sets: [...bluffSets, newBluffSet] };
        newBluffSet = null;
        await saveGrimoire();
    }

    // CLOCK CONNECTION - always the clock this grim lives under, no manual picker
    let clockClient = $state<Clocktower | null>(null);
    let showClock = $state(true);
    let showTimerOptions = $state(false);

    // The night it is, or the coming night during the day: the first night until day 1.
    const currentNight = $derived<'first' | 'other'>((clockClient?.day || 0) > 0 ? 'other' : 'first');

    // NIGHT ORDER
    // The night order sheet: every character that wakes, in order, on the first night or the other nights. The
    // script's own characters always show; the rest (travellers, loric, fabled and characters off the script) only
    // when they're on the grim.
    let nightOrderSheet = $state<'first' | 'other' | null>(null);
    // The night order rows (by character or info step id) showing their communications presets.
    let nightCommsOpen = $state(new Set<string>());
    function toggleNightComms(key: string) {
        const next = new Set(nightCommsOpen);
        next.has(key) ? next.delete(key) : next.add(key);
        nightCommsOpen = next;
    }
    const onGrimCharacterIds = $derived(model.placedCharacterIds);
    // In play but every token for them dead (and none kept waking by a "Has ability" reminder), so they may not wake
    const deadCharacterIds = $derived(new Set([...onGrimCharacterIds].filter(id =>
        placedTokens.filter(t => t.characterId === id).every(t => t.isDead && !model.wakesInNightOrder(t)))));
    // In play, not all dead, but none of them waking: the live ones have no ability (see GrimModel.wakesInNightOrder)
    const noAbilityCharacterIds = $derived(new Set([...onGrimCharacterIds].filter(id => !deadCharacterIds.has(id) &&
        placedTokens.filter(t => t.characterId === id).every(t => !model.wakesInNightOrder(t)))));
    const nightSheetCharacters = $derived.by(() => {
        if (!nightOrderSheet) return [];
        const orderOf = nightOrderSheet === 'first' ? (c: ScriptCharacter) => c.scriptFirstNightOrder : (c: ScriptCharacter) => c.scriptOtherNightOrder;
        const onScript = new Set(script?.characters.filter(c => !isSideCategory(c)).map(c => c.id) ?? []);
        return model.allCharacters
            .filter(c => orderOf(c) !== null && (onScript.has(c.id) || onGrimCharacterIds.has(c.id)))
            .sort((a, b) => (orderOf(a) as number) - (orderOf(b) as number));
    });

    // With 7 or more players (not counting travellers), the Minions and the Demon learn each other on the first
    // night. Each step goes before the first character whose canonical first night order comes after it, and has the
    // cards it shows as communications (and the Demon's bluffs).
    const headerPreset = (text: string): MessagePreset => ({ name: text, elements: [{ type: 'text', value: text, style: 'Header' }] });
    const FIRST_NIGHT_INFO_STEPS = [
        { id: 'minioninfo', name: 'Minion Info', defaultOrder: 6,
            rules: 'If more than one Minion, they all make eye contact with each other. Show the "This is the Demon" card. Point to the Demon.',
            presets: [headerPreset('This is the demon')], bluffs: false },
        { id: 'demoninfo', name: 'Demon Info', defaultOrder: 9,
            rules: 'Show the "These are your minions" card. Point to each Minion. Show the "These characters are not in play" card. Show 3 not-in-play good character tokens.',
            presets: [headerPreset('These are your minions')], bluffs: true }
    ];
    // The players (the named tokens, or every token while none are named), less the travellers
    const playerCount = $derived(model.seatedTokens
        .filter(t => characterById.get(t.characterId ?? '')?.category !== 'traveler').length);
    // Shown under the clock: the players (travellers included) not marked dead
    const aliveCount = $derived(model.seatedTokens.filter(t => !t.isDead).length);
    type NightSheetEntry = { kind: 'character'; character: ScriptCharacter } | ({ kind: 'info' } & typeof FIRST_NIGHT_INFO_STEPS[number]);
    const nightSheetEntries = $derived.by(() => {
        const entries: NightSheetEntry[] = nightSheetCharacters.map(character => ({ kind: 'character', character }));
        if (nightOrderSheet !== 'first' || playerCount < 7) return entries;
        for (const step of FIRST_NIGHT_INFO_STEPS) {
            let insertAt = entries.findIndex(e => e.kind === 'character'
                && e.character.firstNightOrder !== null && e.character.firstNightOrder > step.defaultOrder);
            if (insertAt === -1) insertAt = entries.length;
            entries.splice(insertAt, 0, { kind: 'info', ...step });
        }
        return entries;
    });

    // The communications character picker lists the characters as the token tray does, but with no In-play section
    // and, with a script, just its characters (and the travellers, loric and fabled) rather than every script's.
    const commsSections = $derived(model.traySections.filter(s => s.key !== 'in-play' && (!script || (s.key !== 'other' && !s.key.startsWith('script-')))));
    // It opens with the travellers showing while any are in play (among the tokens auto-arrange seats).
    const commsOpenSections = $derived(
        model.seatedTokens.some(t => characterById.get(t.characterId ?? '')?.category === 'traveler') ? ['traveler'] : []
    );

    let showEndGame = $state(false);

    // Ends the game by deleting its grim, then reopens the grim, empty and with no script (the game always has one).
    // A winner credits the game to the preset it was set up from (if any) before the grim is deleted.
    async function endGame(winner?: 'good' | 'evil') {
        showEndGame = false;
        // Drop any pending autosave so it can't recreate the grim after the delete.
        board?.cancelPendingSave();
        grimSync.close();
        const query = winner ? `?winner=${winner}` : '';
        try {
            const response = await fetch(`grim/state${query}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(response.statusText);
        } catch (er) {
            console.error("Error ending the game:", er);
            alert("Failed to end the game");
            return;
        }
        localStorage.removeItem(`grimoire-state-${data.clockid}`);
        location.reload();
    }

    async function showBluffs(setIndex: number) {
        await saveGrimoire();
        goto(`/admin/${data.clockid}/grim/bluffs?set=${setIndex}`);
    }

    // Communications overlay: null when closed, 'main' for its Preset, Custom and Queue tabs, and 'bluffs' to pick
    // between several bluff sets.
    let commsView = $state<'main' | 'bluffs' | null>(null);
    let commsTab = $state<'preset' | 'custom' | 'queue'>('preset');

    // With the queue on, messages are added to it rather than shown, and then shown together from the Queue tab.
    // svelte-ignore state_referenced_locally
    const messageQueue = new MessageQueue(data.clockid);
    const QUEUED_TOAST_MS = 1800;
    let queuedToast = $state<string | null>(null);
    let queuedToastTimer: ReturnType<typeof setTimeout> | null = null;
    function showQueuedToast(name: string) {
        queuedToast = name;
        if (queuedToastTimer !== null) clearTimeout(queuedToastTimer);
        queuedToastTimer = setTimeout(() => { queuedToast = null; queuedToastTimer = null; }, QUEUED_TOAST_MS);
    }
    $effect(() => () => { if (queuedToastTimer !== null) clearTimeout(queuedToastTimer); });

    function queueMessage(name: string, elements: MessageElement[]) {
        messageQueue.add(name, elements);
        showQueuedToast(name);
    }

    // What's in a queued message, in a line: its text, characters and alignments.
    function messageSummary(elements: MessageElement[]): string {
        return elements.map(e => {
            if (e.type === 'text') return e.value.replaceAll('*', '').trim();
            if (e.type === 'character') return e.value.map(id => availableCharacters[id]?.name ?? id).join(', ');
            return e.value === 'good' ? 'Good' : 'Evil';
        }).filter(Boolean).join(' · ');
    }

    async function showQueue() {
        if (messageQueue.messages.length === 0) return;
        commsView = null;
        await saveGrimoire();
        const params = new URLSearchParams({ messages: JSON.stringify(messageQueue.messages.map(m => $state.snapshot(m.elements))) });
        // They're in the message page's address from here, so the queue is empty again when the storyteller comes
        // back to the grim. Queueing stays on or off as it was.
        messageQueue.clear();
        goto(`/admin/${data.clockid}/grim/message?${params}`);
    }

    // The custom message being built, and which of the builder's screens is showing.
    let messageElements = $state<PresetElement[]>([]);
    let builderView = $state<MessageBuilderView>('builder');

    // svelte-ignore state_referenced_locally
    let textOptions = $state<TextOption[]>(data.textOptions);
    // svelte-ignore state_referenced_locally
    let messagePresets = $state<MessagePreset[]>(data.messagePresets);

    // The Preset tab's builder, in place of its list: a new preset being made (which can have blanks), or a preset
    // with blanks being filled in before it's shown.
    // (forCharacterId: opened from that character's communications, whose pickers show that character's reminders
    // beside each character.)
    // (hadBlanks: a preset being filled in that opened with blanks, rather than only to check its Reminders' characters.)
    let presetEditor = $state<{ mode: 'new' | 'fill'; name: string; elements: PresetElement[]; forCharacterId?: string; hadBlanks?: boolean } | null>(null);
    let presetBuilderView = $state<MessageBuilderView>('builder');
    const presetEditorFilled = $derived(presetEditor !== null && presetEditor.elements.length > 0 && hasNoBlanks(presetEditor.elements));
    // The tabs are hidden while either builder is on one of its own screens (picking characters, say).
    const commsTabsShown = $derived(commsTab === 'preset' ? presetEditor === null || presetBuilderView === 'builder' : builderView === 'builder');

    // The character communications were opened for (from the player info or the night order), if any: named in the
    // overlay, and their reminders shown over the characters in its pickers.
    let commsCharacterId = $state<string | null>(null);
    function openComms(characterId: string | null = null) {
        messageElements = [];
        builderView = 'builder';
        presetEditor = null;
        commsCharacterId = characterId;
        commsView = 'main';
    }

    // Opens communications on its Preset tab, for the character.
    function openPresetComms(characterId: string) {
        openComms(characterId);
        commsTab = 'preset';
    }

    // For a character's communications pickers: their reminders beside each character (none without a character).
    const characterRemindersFor = (characterId: string | null | undefined) => characterId
        ? (id: string) => (model.remindersByCharacterId[id] ?? []).filter(r => r.characterId === characterId)
        : undefined;

    function showCustomMessage() {
        const elements = $state.snapshot(messageElements);
        if (!hasNoBlanks(elements)) return;
        if (messageQueue.enabled) {
            queueMessage(nameFromElements(elements), elements);
            // Ready for the next one
            messageElements = [];
        } else {
            showMessage(elements);
        }
    }

    function newPreset() {
        presetEditor = { mode: 'new', name: '', elements: [] };
        presetBuilderView = 'builder';
    }

    async function saveNewPreset() {
        if (!presetEditor || presetEditor.elements.length === 0) return;
        const elements = $state.snapshot(presetEditor.elements);
        if (await savePreset({ name: presetEditor.name.trim() || nameFromElements(elements), elements })) presetEditor = null;
    }

    function showFilledPreset() {
        if (!presetEditor) return;
        const elements = $state.snapshot(presetEditor.elements);
        if (!hasNoBlanks(elements)) return;
        if (messageQueue.enabled) {
            queueMessage(presetEditor.name.trim() || nameFromElements(elements), elements);
            presetEditor = null;
        } else {
            showMessage(elements);
        }
    }

    // Adds to the saved presets as they are now, so as not to undo changes made in settings since this page loaded.
    async function savePreset(preset: MessagePreset): Promise<boolean> {
        try {
            const current = await fetch('/api/messagePresets').then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json() as Promise<MessagePreset[]>;
            });
            const updated = [...current, preset];
            const res = await fetch('/api/messagePresets', {
                method: 'POST',
                body: JSON.stringify(updated),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error(`${res.status}`);
            messagePresets = updated;
            return true;
        } catch {
            alert('Failed to save the preset');
            return false;
        }
    }

    // Removes the preset from the saved presets as they are now, as savePreset adds to them.
    async function deletePreset(preset: MessagePreset) {
        if (!confirm(`Delete the preset "${presetDisplayName(preset)}"? This can't be undone.`)) return;
        try {
            const current = await fetch('/api/messagePresets').then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json() as Promise<MessagePreset[]>;
            });
            const key = JSON.stringify(preset);
            const index = current.findIndex(p => JSON.stringify(p) === key);
            const updated = current.filter((_, i) => i !== index);
            const res = await fetch('/api/messagePresets', {
                method: 'POST',
                body: JSON.stringify(updated),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error(`${res.status}`);
            messagePresets = updated;
        } catch {
            alert('Failed to delete the preset');
        }
    }

    async function showMessage(elements: MessageElement[]) {
        commsView = null;
        await saveGrimoire();
        const params = new URLSearchParams({ elements: JSON.stringify(elements) });
        goto(`/admin/${data.clockid}/grim/message?${params}`);
    }

    // A preset's elements with each Reminder element made the character of the player beside that reminder (the
    // seated token nearest it by angle), or a blank to fill in if the reminder isn't on the grim, is on it more than
    // once, or is beside a token with no character. A player with any of the Drunk's reminders beside them is the
    // Drunk, whatever their token shows.
    // Each Their alignment element is made the alignment of the character's player: the token whose popup it was
    // opened from, or else the one seated token with that character, or a blank if there's none or more than one.
    // And each Auto demon is made the demon in play: the one seated demon, or a blank if there's none or more than one.
    const DRUNK_ID = 'drunk';
    function withRemindersResolved(elements: PresetElement[], forCharacterId?: string): PresetElement[] {
        const seated = model.seatedTokens;
        const withCharacter = forCharacterId ? seated.filter(t => t.characterId === forCharacterId) : [];
        const ownPlayer = forCharacterId && activeToken?.characterId === forCharacterId ? activeToken
            : withCharacter.length === 1 ? withCharacter[0] : null;
        const demons = seated.filter(t => characterById.get(t.characterId ?? '')?.category === 'demon');
        const remindersByToken = remindersBySeatedToken(placedTokens, placedReminders, model.isSideRoleToken);
        const isDrunk = (token: PlacedToken) =>
            (remindersByToken.get(token.id) ?? []).some(r => availableReminderTokens[r.tokenId]?.characterId === DRUNK_ID);
        return elements.map((element): PresetElement => {
            if (element.type === 'inPlayDemon') return demons.length === 1 ? { type: 'character', value: [demons[0].characterId!] } : { type: 'blank' };
            if (element.type === 'playerAlignment') return ownPlayer ? { type: 'alignment', value: ownPlayer.alignment } : { type: 'blank' };
            if (element.type !== 'reminderCharacter') return element;
            const placed = placedReminders.filter(r => r.tokenId === element.reminderTokenId);
            if (placed.length !== 1) return { type: 'blank' };
            const player = nearestByAngle(placed[0], seated);
            const characterId = player && (isDrunk(player) && characterById.has(DRUNK_ID) ? DRUNK_ID : player.characterId);
            return characterId ? { type: 'character', value: [characterId] } : { type: 'blank' };
        });
    }

    // A preset with Reminder elements opens in the builder too, with the characters they found (or blanks) in their
    // places, to check or change before it's shown.
    function showPreset(preset: MessagePreset, forCharacterId?: string) {
        const elements = withRemindersResolved(preset.elements, forCharacterId);
        // A preset with blanks opens in the builder first, to fill them in (opening communications, if it isn't open).
        if (!hasNoBlanks(elements) || preset.elements.some(e => e.type === 'reminderCharacter')) {
            if (commsView === null) openComms(forCharacterId ?? null);
            commsView = 'main';
            commsTab = 'preset';
            presetEditor = { mode: 'fill', name: preset.name, elements: structuredClone($state.snapshot(elements)), forCharacterId, hadBlanks: !hasNoBlanks(elements) };
            presetBuilderView = 'builder';
        } else if (messageQueue.enabled) {
            queueMessage(presetDisplayName(preset), elements);
        } else {
            showMessage(elements);
        }
    }

    // A character's own presets for the night, offered in the player info and the night order.
    const characterPresetsFor = (characterId: string | null | undefined, night: 'first' | 'other') => {
        const character = characterById.get(characterId ?? '');
        return character ? characterMessagePresetsFor(character, night) : [];
    };

    // What the board's player info offers to communicate to a character's player: their presets for tonight.
    const boardComms = {
        presetsFor: (characterId: string) => characterPresetsFor(characterId, currentNight),
        showPreset: (preset: MessagePreset, characterId: string) => showPreset(preset, characterId),
        openPresetComms
    };

    // The bluffs from communications: queued as a message like the bluffs page, or shown on that page.
    function showCommsBluffs(setIndex: number) {
        if (messageQueue.enabled) {
            queueMessage(bluffSets.length > 1 ? `Bluff set ${setIndex + 1}` : 'Bluffs', [
                { type: 'text', value: 'These roles are not in play', style: 'Header' },
                { type: 'character', value: [...bluffSets[setIndex]] }
            ]);
            commsView = 'main';
        } else {
            commsView = null;
            showBluffs(setIndex);
        }
    }

    function chooseBluffs() {
        if (bluffSets.length === 1) {
            showCommsBluffs(0);
        } else if (bluffSets.length > 1) {
            commsView = 'bluffs';
        } else if (script && loadedPreset) {
            commsView = null;
            newBluffSet = [];
        }
    }

    async function viewCharacter(characterId: string) {
        await saveGrimoire();
        goto(`/admin/${data.clockid}/grim/character/${characterId}`);
    }

    onMount(()=>{
        if(!browser) return;
        clockClient = new Clocktower(data.model);
        grimSync.connect();

        return () => {
            clockClient?.close();
            grimSync.close();
        }
    });
</script>

<style>
    /* Pins the whole grim view to the viewport and clips everything else (e.g. the hidden tray sitting
       below the screen, popups, drag ghosts) so nothing can extend the page's scrollable area. */
    .grim-root {
        position: fixed;
        inset: 0;
        overflow: hidden;
        overscroll-behavior: none;
        background-color: #121212;
        /* All touch gestures (pinch/pan/drag) are handled in JS; stop the browser zooming or scrolling the page. */
        touch-action: none;
        /* The undo button sits just left of the save status, which is just left of the Close button */
        --grim-undo-right: 104px;
        --grim-undo-top: 8px;
    }

    /* Each bluff set is a button only as big as its tokens; they wrap onto more rows as needed. */
    .bluff-set-buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5em;
        padding: 0.5em;
    }

    .bluff-set-item {
        position: relative;
    }

    .delete-bluff-set-btn {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.75);
        color: white;
        font-size: 0.8em;
        line-height: 1;
        cursor: pointer;
        touch-action: manipulation;
    }

    .show-bluffs-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6em;
    }

    /* An empty set: the outline of a set's button and tokens, dashed. */
    .add-bluff-set-btn {
        /* Dimmer than the plus, so the empty set reads as a faint placeholder. */
        --bluff-outline: color-mix(in srgb, currentColor 40%, transparent);
        background: transparent;
        /* Less padding to make up for the border, so it's the size of a set's button. */
        border: 2px dashed var(--bluff-outline);
        padding: 3px 8px;
        opacity: 0.7;
    }

    .add-bluff-set-btn .bluff-placeholder {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: 2px dashed var(--bluff-outline);
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        line-height: 1;
    }

    .show-bluffs-icon {
        display: flex;
        gap: 2px;
    }

    /* Each bluff set to choose from in communications: its name over its tokens. */
    .comms-bluff-set {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4em;
    }
    .comms-bluff-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
    }

    .overlay-panel.comms-panel {
        width: 100%;
        height: 100%;
        max-height: none;
        margin: 0;
        border-radius: 0;
        padding-top: 3.5em;
        /* Its content no wider than 720px, centred; padded rather than narrowed, so it scrolls from anywhere on screen */
        padding-inline: max(1.2em, calc((100% - 720px) / 2));
        justify-content: flex-start;
        overflow-y: auto;
    }

    .overlay-panel.night-sheet {
        width: min(92vw, 560px);
        height: 92%;
        padding-top: 1.2em;
        align-items: stretch;
        text-align: left;
        /* Only the list scrolls, so the close button and tabs stay put */
        overflow: hidden;
    }

    /* Full screen on a phone, like the communications panel */
    @media (max-width: 768px) {
        .overlay-panel.night-sheet {
            width: 100%;
            height: 100%;
            max-height: none;
            margin: 0;
            border-radius: 0;
        }
    }

    /* The tab bar from the music settings */
    .overlay-tabs {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
        border-bottom: 1px solid var(--theme-bg-tertiary);
    }

    .overlay-tabs > button[role="tab"] {
        flex: 1;
        padding: 0.6em 0.3em;
        font-size: 1rem;
        background: none;
        color: var(--theme-on-bg);
        border: none;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
        white-space: nowrap;
        cursor: pointer;
    }

    .overlay-tabs > button[role="tab"]:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }

    .overlay-tabs > button[role="tab"].selected {
        opacity: 1;
        border-bottom-color: var(--theme-highlight);
        font-weight: bold;
    }

    .night-sheet-empty {
        text-align: center;
        opacity: 0.6;
    }

    .night-sheet-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    /* A row, with its presets (when open) below it */
    .night-sheet-list > li {
        display: flex;
        flex-direction: column;
        padding: 0.4em 0.6em;
        border-radius: 0.6em;
        border-left: 4px solid transparent;
        opacity: 0.55;
    }

    /* The image, the text and the communications icon always in a row; the whole of it opens the communications */
    .night-sheet-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7em;
        width: 100%;
        text-align: left;
        color: inherit;
    }

    button.night-sheet-row {
        cursor: pointer;
    }

    .night-sheet-list > li.in-play {
        opacity: 1;
        background: var(--theme-bg-tertiary);
        border-left-color: var(--theme-highlight);
    }

    /* Halfway between an in-play character's background and none, as a character not in play has */
    .night-sheet-list > li.in-play.dead {
        background: color-mix(in srgb, var(--theme-bg-tertiary) 50%, transparent);
        border-left-color: #555;
    }

    .night-sheet-list img {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        object-fit: contain;
    }

    /* Stands in for a character image on the Minion and Demon info steps */
    .night-sheet-info-icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 50%;
        background: radial-gradient(circle, #8b1a1a 0 40%, transparent 42%);
    }

    .night-sheet-name {
        font-weight: bold;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .night-sheet-badge {
        font-size: 0.7em;
        font-weight: normal;
        padding: 0.15em 0.6em;
        border-radius: 1em;
        background: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .night-sheet-badge.dead {
        background: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
    }

    /* The communications icon at the end of a row that has some, highlighted while its presets are showing */
    .night-sheet-comms {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .night-sheet-row.open .night-sheet-comms {
        color: var(--theme-highlight);
    }

    /* A row's communications presets, opened under it by its communications button */
    .night-sheet-presets {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
            /* Padding rather than the row's gap, so it grows and shrinks with the presets as they slide open and shut */
        padding-top: 0.4em;
}

    /* As the token popup's buttons; less padded than the overlay's own */
    .overlay-panel .night-sheet-presets > .popup-toggle {
        width: 100%;
        padding: 0.6em 1em;
        font-size: 0.95em;
    }

    .night-sheet-comms .button-icon {
        width: 1.3em;
        height: 1.3em;
    }

    .night-sheet-rules {
        /* Keep the line breaks in reminders and abilities */
        white-space: pre-line;
        font-size: 0.85em;
        opacity: 0.85;
    }

    .overlay-panel.comms-panel > button.button-style {
        width: 100%;
        flex-shrink: 0;
    }

    .comms-tabs {
        width: 100%;
        margin-bottom: 0.5em;
    }

    .comms-empty {
        opacity: 0.6;
    }

    /* A preset's button, with its delete button over its end */
    .comms-preset-row {
        position: relative;
        width: 100%;
        flex-shrink: 0;
    }

    .comms-preset-row > .button-style {
        width: 100%;
        padding-inline: 2.8em;
    }

    .comms-preset-delete {
        position: absolute;
        right: 0.5em;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        padding: 0.35em;
        border-radius: 0.4em;
        opacity: 0.6;
        cursor: pointer;
    }

    .comms-preset-delete:hover {
        opacity: 1;
        color: #e05a5a;
    }

    /* As the tab buttons beside it, with the checkbox that turns the queue on */
    .overlay-tabs > .queue-tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45em;
        padding: 0.4em 0.3em;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
        white-space: nowrap;
        cursor: pointer;
    }

    .overlay-tabs > .queue-tab:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }

    .overlay-tabs > .queue-tab.selected {
        opacity: 1;
        border-bottom-color: var(--theme-highlight);
        font-weight: bold;
    }

    .queue-tab input {
        margin: 0;
        width: 1.6em;
        height: 1.6em;
        flex-shrink: 0;
    }

    .queue-item {
        width: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.5em 0.6em;
        border-radius: 8px;
        background: var(--theme-bg-tertiary);
        text-align: left;
    }

    .queue-item-text {
        flex: 1;
        min-width: 0;
    }

    .queue-item-name {
        font-weight: bold;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .queue-item-summary {
        font-size: 0.85em;
        opacity: 0.7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .queue-item-btn {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
        color: inherit;
        font-size: 1em;
        cursor: pointer;
        touch-action: manipulation;
    }

    .queue-item-btn:disabled {
        opacity: 0.3;
        cursor: default;
    }

    .queue-item-btn svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    .overlay-panel.comms-panel > button.queue-clear {
        margin-top: 0.8em;
    }

    /* Over the communications panel, which fills the screen, and below its Back button. Doubled up to win over
       .locked-toast's position, which comes later. */
    .locked-toast.queued-toast {
        top: 60px;
        max-width: calc(100% - 32px);
        box-sizing: border-box;
    }

    .queued-toast span {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* A new preset's name, above its builder */
    .comms-panel .preset-name {
        width: 100%;
        box-sizing: border-box;
        padding: 0.7em;
        font-size: 1.1em;
    }

    .preset-editor-title {
        font-size: 1.3em;
        font-weight: bold;
    }

    /* Set apart from the presets above it, as it makes one rather than showing one */
    .overlay-panel.comms-panel > button.new-preset {
        margin-top: 0.8em;
        border: 2px dashed currentColor;
        background: none;
        opacity: 0.7;
    }

    .overlay-panel.comms-panel > button.new-preset:hover {
        opacity: 1;
    }

    .sidebar-btn.end-game-btn {
        color: #ff7b7b;
    }

    /* Just left of the Close button, centred on it */
    .save-status {
        position: absolute;
        top: 12px;
        right: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        pointer-events: none;
    }

    .save-status svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
    }

    .save-status.saved svg {
        fill: #4ade80;
    }

    .save-status.unsaved svg {
        fill: #f1c40f;
    }

    .save-status.error svg {
        fill: #e74c3c;
    }

    .save-status.saving svg {
        animation: save-status-spin 0.9s linear infinite;
    }

    .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
    }

    @keyframes save-status-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

</style>


    <!-- No long-press menu (on Android, "save image" and the like) anywhere but in text boxes -->
    <div class="grim-root grim-ui" role="presentation" oncontextmenu={(e) => { if (!(e.target as Element).closest('input, textarea')) e.preventDefault(); }}>
    <div class="save-status {saveStatus}" class:drag-hidden={boardDragging} style="z-index: {GRIM_Z.ui};" title={
        saveStatus === 'saved' ? 'All changes saved'
        : saveStatus === 'saving' ? 'Saving…'
        : saveStatus === 'error' ? 'Failed to save changes'
        : 'Unsaved changes'
    }>
        {#if saveStatus === 'saved'}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={checkIcon}/></svg>
        {:else if saveStatus === 'saving'}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={syncIcon}/></svg>
        {:else if saveStatus === 'error'}
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={warningFillIcon}/></svg>
        {:else}
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
        {/if}
    </div>

    <GrimBoard
        bind:this={board}
        bind:activeTokenId
        bind:dragging={boardDragging}
        {model}
        {undo}
        lockStorageKey="grimoire-locked-{data.clockid}"
        night={currentNight}
        onsave={() => grimSync.save()}
        onunsaved={() => saveStatus = 'unsaved'}
        onshowcharacter={viewCharacter}
        comms={boardComms}
        trayBluffs={loadedPreset ? { count: bluffSets.length, content: trayBluffs } : undefined}
        {sidebarTop}
        {sidebarMenuStart}
        {sidebarMenuEnd}
        {topRight}
        {centre}
        ignoreGesturesOn=".close-btn"
    />

    <!-- In the top right corner, right of the save status; under the token tray, as the board's own buttons are -->
    {#snippet topRight()}
        <button class="sidebar-btn close-btn" class:drag-hidden={boardDragging} style="z-index: {GRIM_Z.ui};" onclick={() => {saveGrimoire().then(()=>goto(`/play`, { replaceState: true }))} } title="Back to Play" aria-label="Back to Play">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={closeIcon}/></svg>
        </button>
    {/snippet}

    {#snippet sidebarTop()}
        <!-- Clock controls, as tapping the clock in the middle opens -->
        <button class="sidebar-btn" class:active={showTimerOptions} onclick={() => showTimerOptions = true} title="Clock controls">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={timerIcon}/></svg>
        </button>

        <!-- Communications: things to show a player -->
        <button class="sidebar-btn" class:active={commsView !== null} onclick={() => openComms()} title="Communications">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={smsIcon}/></svg>
        </button>

        <!-- Night order: who wakes, and when, on the first night and the other nights -->
        <button class="sidebar-btn" class:active={nightOrderSheet !== null} onclick={() => nightOrderSheet = currentNight} title="Night order">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={listAltIcon}/></svg>
        </button>

        <!-- Hide the grim behind a blank page, e.g. before leaving the device unattended. Replaces this page in the
             history, so the browser's back button doesn't bring it back up (and Unhide does the same the other way). -->
        <button class="sidebar-btn" onclick={() => {saveGrimoire().then(()=>goto(`/admin/${data.clockid}/grim/hidden`, { replaceState: true }))} } title="Hide grimoire">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={visibilityIcon}/></svg>
        </button>
    {/snippet}

    {#snippet sidebarMenuStart()}
        <!-- Set up a new game on this grim (or reset it) -->
        <button class="sidebar-btn" onclick={() => {saveGrimoire().then(()=>goto(`/admin/${data.clockid}/grim/setup`))} } title="Set up a new game">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={addBoxIcon}/></svg>
        </button>
    {/snippet}

    {#snippet sidebarMenuEnd()}
        <!-- Show/Hide clock -->
        <button class="sidebar-btn" class:active={showClock} onclick={() => showClock = !showClock} title="{showClock ? 'Hide' : 'Show'} clock">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={scheduleIcon}/></svg>
        </button>

        <!-- Refresh page button -->
        <button class="sidebar-btn" onclick={() => location.reload()} title="Refresh page">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={refreshIcon}/></svg>
        </button>

        <!-- End the game, recording who won, and clear the grim -->
        <button class="sidebar-btn end-game-btn" onclick={() => showEndGame = true} title="End game">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={sportsScoreIcon}/></svg>
        </button>
    {/snippet}

    {#snippet centre()}
        {#if showClock}
            <!-- The clock face itself ignores pointer input (so panning/dragging works over it); only a button over its centre 50% opens the timer options. -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 2em; text-shadow: 0 0 10px rgba(0,0,0,0.7); z-index: {GRIM_Z.clock}; pointer-events: none;">
                {#if clockClient}
                <div style="position: relative; width: {tokenSize * CLOCK_SCALE + 35}px; height: {tokenSize * CLOCK_SCALE + 35}px; margin: 0 auto;">
                    <FullDisplay model={clockClient} size={tokenSize * CLOCK_SCALE} displayMode='original' showInstructions={false} outerShadow='shadow'>
                        <!-- Under the clock: the alive count, its number larger than the word (line-height 0 so it doesn't push the line down) -->
                        {#snippet subtitle()}<span style="font-size: 1.8em; line-height: 0;">{aliveCount}</span> alive{/snippet}
                    </FullDisplay>
                    <button class="no-button-style" aria-label="Clock controls" style="position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; border-radius: 50%; pointer-events: auto;" onclick={()=>showTimerOptions = true}></button>
                </div>
                {/if}
            </div>
        {/if}
    {/snippet}

    <!-- The bluff sets, above the script's characters in the token tray -->
    {#snippet trayBluffs()}
        <div class="bluff-set-buttons">
        {#each bluffSets as bluffSet, setIndex}
        <div class="bluff-set-item">
        <button class="button-style show-bluffs-btn" onclick={() => showBluffs(setIndex)} title={bluffSets.length > 1 ? `Show bluffs ${setIndex + 1}` : 'Show bluffs'} aria-label={bluffSets.length > 1 ? `Show bluffs ${setIndex + 1}` : 'Show bluffs'}>
            <span class="show-bluffs-icon">
                {#each bluffSet.slice(0, 3) as bluffId (bluffId)}
                    {@const bluff = characterById.get(bluffId)}
                    {#if bluff}
                        <div style="position: relative; width: 56px; height: 56px;">
                            <CharacterToken character={bluff} style="position: relative;" size="56px" imageSize={TRAY_IMAGE_SIZE} norules/>
                            {#if seatedCharacterIdSet.has(bluffId)}<InPlayWarning size="20px" style="position: absolute; bottom: -3px; right: -3px;"/>{/if}
                        </div>
                    {/if}
                {/each}
            </span>
        </button>
        <button class="delete-bluff-set-btn" onclick={() => deleteBluffSet(setIndex)} title="Delete bluff set" aria-label="Delete bluff set"><MaterialIcon icon={deleteIcon} size="1.25em"/></button>
        </div>
        {/each}
        <button class="button-style show-bluffs-btn add-bluff-set-btn" onclick={() => newBluffSet = []} title="Add bluff set" aria-label="Add bluff set">
            <span class="show-bluffs-icon">
                <span class="bluff-placeholder"></span>
                <span class="bluff-placeholder">+</span>
                <span class="bluff-placeholder"></span>
            </span>
        </button>
        </div>
    {/snippet}

        <!-- A night order row's image and text, and its communications icon if it has any: the whole row shows its one
             preset, or shows or hides its presets below it (expanded: whether they're showing, null with one preset) -->
        {#snippet nightRow(head: Snippet, onclick: (() => void) | null, label: string, expanded: boolean | null)}
            {#if onclick}
                <button class="no-button-style night-sheet-row" class:open={expanded === true} aria-expanded={expanded ?? undefined} {onclick} title={label}>
                    {@render head()}
                    <span class="night-sheet-comms">{@render commsIcon()}</span>
                </button>
            {:else}
                <div class="night-sheet-row">{@render head()}</div>
            {/if}
        {/snippet}
        {#snippet commsIcon()}
            <svg class="button-icon" viewBox={ICON_VIEWBOX} aria-hidden="true" fill="currentColor"><path d={smsIcon}/></svg>
        {/snippet}

    {#if nightOrderSheet}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {GRIM_Z.ui + 20};" onclick={() => nightOrderSheet = null}>
            <!-- Outside the panel, so it stays put while the panel scrolls -->
            <button class="overlay-close overlay-corner-close" onclick={(e) => { e.stopPropagation(); nightOrderSheet = null; }} aria-label="Close" title="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="overlay-panel night-sheet" onclick={(e) => e.stopPropagation()}>
                <div class="overlay-tabs" role="tablist" aria-label="Night order">
                    <button role="tab" aria-selected={nightOrderSheet === 'first'} class:selected={nightOrderSheet === 'first'} onclick={() => nightOrderSheet = 'first'}>First night</button>
                    <button role="tab" aria-selected={nightOrderSheet === 'other'} class:selected={nightOrderSheet === 'other'} onclick={() => nightOrderSheet = 'other'}>Other nights</button>
                </div>
                {#if nightSheetEntries.length === 0}
                    <p class="night-sheet-empty">Nobody wakes.</p>
                {:else}
                    <ol class="night-sheet-list">
                        {#each nightSheetEntries as entry (entry.kind === 'info' ? entry.id : entry.character.id)}
                            {#if entry.kind === 'info'}
                            {@const single = entry.presets.length === 1 && !entry.bluffs}
                            <li class="in-play">
                                {#snippet infoHead()}
                                    <div class="night-sheet-info-icon" aria-hidden="true"></div>
                                    <div class="night-sheet-text">
                                        <div class="night-sheet-name">{entry.name}</div>
                                        <div class="night-sheet-rules">{entry.rules}</div>
                                    </div>
                                {/snippet}
                                {@render nightRow(infoHead, single ? () => showPreset(entry.presets[0]) : () => toggleNightComms(entry.id),
                                    `${entry.name} communications`, single ? null : nightCommsOpen.has(entry.id))}
                                {#if !single && nightCommsOpen.has(entry.id)}
                                    <div class="night-sheet-presets" transition:slide={{ duration: 200 }}>
                                        {#each entry.presets as preset}
                                            <button class="popup-toggle" onclick={() => showPreset(preset)}>{presetDisplayName(preset)}</button>
                                        {/each}
                                        {#if entry.bluffs}
                                            <button class="popup-toggle" disabled={bluffSets.length === 0 && !(script && loadedPreset)} onclick={chooseBluffs}>
                                                {bluffSets.length === 0 ? 'Bluffs (create a bluff set)' : 'Bluffs'}
                                            </button>
                                        {/if}
                                    </div>
                                {/if}
                            </li>
                            {:else}
                            {@const character = entry.character}
                            {@const inPlay = onGrimCharacterIds.has(character.id)}
                            {@const presets = nightOrderSheet ? characterPresetsFor(character.id, nightOrderSheet) : []}
                            {@const asleep = inPlay && (deadCharacterIds.has(character.id) || noAbilityCharacterIds.has(character.id))}
                            <li class:in-play={inPlay} class:dead={asleep}>
                                {#snippet characterHead()}
                                    <img src={characterImageUrl(character.id, 128)} alt="" onerror={(e) => (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'} />
                                    <div class="night-sheet-text">
                                        <div class="night-sheet-name">
                                            {character.name}
                                            {#if inPlay}<span class="night-sheet-badge" class:dead={asleep}>{deadCharacterIds.has(character.id) ? 'Dead' : noAbilityCharacterIds.has(character.id) ? 'No ability' : 'In play'}</span>{/if}
                                        </div>
                                        <div class="night-sheet-rules">{(nightOrderSheet === 'first' ? character.firstNightReminder : character.otherNightReminder) || character.rules}</div>
                                    </div>
                                {/snippet}
                                {@render nightRow(characterHead,
                                    presets.length === 1 ? () => showPreset(presets[0], character.id) : presets.length > 1 ? () => toggleNightComms(character.id) : null,
                                    `${character.name}'s communications`, presets.length > 1 ? nightCommsOpen.has(character.id) : null)}
                                {#if presets.length > 1 && nightCommsOpen.has(character.id)}
                                    <div class="night-sheet-presets" transition:slide={{ duration: 200 }}>
                                        {#each presets as preset}
                                            <button class="popup-toggle" onclick={() => showPreset(preset, character.id)}>{presetDisplayName(preset)}</button>
                                        {/each}
                                    </div>
                                {/if}
                            </li>
                            {/if}
                        {/each}
                    </ol>
                {/if}
            </div>
        </div>
    {/if}

    {#if commsView !== null}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {GRIM_Z.ui + 20};" onclick={() => commsView = null}>
            <!-- Outside the panel, so it stays put while the panel scrolls -->
            <button class="overlay-close overlay-corner-close" onclick={(e) => { e.stopPropagation(); commsView = null; }} aria-label="Close" title="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="overlay-panel comms-panel" onclick={(e) => e.stopPropagation()}>
                {#if commsView === 'bluffs'}
                    <div class="overlay-name dumbledore-font">Which bluffs?</div>
                    {#each bluffSets as bluffSet, setIndex}
                        <button class="button-style comms-bluff-set" onclick={() => showCommsBluffs(setIndex)}>
                            <span>Bluff set {setIndex + 1}</span>
                            <span class="comms-bluff-tokens">
                                {#each bluffSet as bluffId (bluffId)}
                                    {@const bluff = characterById.get(bluffId)}
                                    {#if bluff}
                                        <span style="position: relative; width: 52px; height: 52px;">
                                            <CharacterToken character={bluff} style="position: relative;" size="52px" imageSize={TRAY_IMAGE_SIZE} norules/>
                                            {#if seatedCharacterIdSet.has(bluffId)}<InPlayWarning size="20px" style="position: absolute; bottom: -3px; right: -3px;"/>{/if}
                                        </span>
                                    {/if}
                                {/each}
                            </span>
                        </button>
                    {/each}
                {:else}
                    {#if commsTabsShown}
                        <div class="overlay-name dumbledore-font">Communications</div>
                        {#if commsCharacterId && characterById.get(commsCharacterId)}
                            <div class="overlay-category">For {characterById.get(commsCharacterId)?.name}</div>
                        {/if}
                        <div class="overlay-tabs comms-tabs" role="tablist" aria-label="Communications">
                            <button role="tab" aria-selected={commsTab === 'preset'} class:selected={commsTab === 'preset'} onclick={() => commsTab = 'preset'}>Preset</button>
                            <button role="tab" aria-selected={commsTab === 'custom'} class:selected={commsTab === 'custom'} onclick={() => commsTab = 'custom'}>Custom</button>
                            <!-- Not a button, so it can hold the checkbox that turns queueing on -->
                            <div role="tab" tabindex="0" class="queue-tab" aria-selected={commsTab === 'queue'} class:selected={commsTab === 'queue'}
                                onclick={() => commsTab = 'queue'} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commsTab = 'queue'; } }}>
                                <input type="checkbox" checked={messageQueue.enabled} onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}
                                    onchange={(e) => messageQueue.setEnabled(e.currentTarget.checked)} aria-label="Add messages to the queue" title="Add messages to the queue instead of showing them" />
                                Queue{messageQueue.messages.length ? ` (${messageQueue.messages.length})` : ''}
                            </div>
                        </div>
                    {/if}
                    {#if commsTab === 'queue'}
                        <p class="comms-empty">
                            {messageQueue.enabled ? 'Messages are added here instead of being shown.' : 'Tick Queue to add messages here instead of showing them.'}
                        </p>
                        {#each messageQueue.messages as message, i (message.id)}
                            <div class="queue-item">
                                <div class="queue-item-text">
                                    <div class="queue-item-name">{message.name}</div>
                                    <div class="queue-item-summary">{messageSummary(message.elements)}</div>
                                </div>
                                <button class="queue-item-btn" disabled={i === 0} onclick={() => messageQueue.move(message.id, -1)} aria-label="Move up" title="Move up">
                                    <svg viewBox={ICON_VIEWBOX} aria-hidden="true" fill="currentColor"><path d={keyboardArrowUpIcon}/></svg>
                                </button>
                                <button class="queue-item-btn" disabled={i === messageQueue.messages.length - 1} onclick={() => messageQueue.move(message.id, 1)} aria-label="Move down" title="Move down">
                                    <svg viewBox={ICON_VIEWBOX} aria-hidden="true" fill="currentColor"><path d={keyboardArrowDownIcon}/></svg>
                                </button>
                                <button class="queue-item-btn" onclick={() => messageQueue.remove(message.id)} aria-label="Remove" title="Remove"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                            </div>
                        {/each}
                        {#if messageQueue.messages.length > 0}
                            <button class="button-style queue-clear" onclick={() => messageQueue.clear()}>Clear</button>
                        {/if}
                        <button class="button-style highlight" disabled={messageQueue.messages.length === 0} onclick={showQueue}>Show</button>
                    {:else if commsTab === 'preset' && presetEditor}
                        {#if presetBuilderView === 'builder'}
                            {#if presetEditor.mode === 'new'}
                                <input type="text" class="preset-name" placeholder="Preset name" bind:value={presetEditor.name} aria-label="Preset name" />
                            {:else}
                                <div class="preset-editor-title">{presetEditor.name.trim() || nameFromElements(presetEditor.elements)}</div>
                                <p class="comms-empty">{presetEditor.hadBlanks ? 'Fill in the blanks to show it.' : 'Check it, or change it, before showing it.'}</p>
                            {/if}
                        {/if}
                        <MessageBuilder
                            bind:elements={presetEditor.elements}
                            bind:view={presetBuilderView}
                            bind:textOptions
                            sections={commsSections}
                            characters={availableCharacters}
                            faded={id => !isInPlay(id)}
                            openSections={commsOpenSections}
                            reminders={characterRemindersFor(presetEditor.forCharacterId ?? commsCharacterId)}
                            tokenSize={trayTokenSize}
                            imageSize={TRAY_IMAGE_SIZE}
                            blanks={presetEditor.mode === 'new' ? 'add' : 'fill'}
                        />
                        {#if presetBuilderView === 'builder'}
                            {#if presetEditor.mode === 'new'}
                                <button class="button-style highlight" disabled={presetEditor.elements.length === 0} onclick={saveNewPreset}><MaterialIcon icon={saveIcon} size="1.2em"/> Save preset</button>
                            {:else}
                                <button class="button-style highlight" disabled={!presetEditorFilled} onclick={showFilledPreset}>{messageQueue.enabled ? 'Add to queue' : 'Show'}</button>
                            {/if}
                            <button class="button-style" onclick={() => presetEditor = null}>Cancel</button>
                        {/if}
                    {:else if commsTab === 'preset'}
                        {#each messagePresets as preset}
                            <div class="comms-preset-row">
                                <button class="button-style" onclick={() => showPreset(preset, commsCharacterId ?? undefined)}>{presetDisplayName(preset)}</button>
                                <button class="no-button-style comms-preset-delete" onclick={() => deletePreset(preset)}
                                    aria-label="Delete {presetDisplayName(preset)}" title="Delete preset"><TrashIcon size={20}/></button>
                            </div>
                        {:else}
                            <p class="comms-empty">No presets yet.</p>
                        {/each}
                        <button class="button-style" disabled={bluffSets.length === 0 && !(script && loadedPreset)} onclick={chooseBluffs}>
                            {bluffSets.length === 0 ? 'Bluffs (create a bluff set)' : 'Bluffs'}
                        </button>
                        <button class="button-style new-preset" onclick={newPreset}>+ New preset</button>
                    {:else}
                        <MessageBuilder
                            bind:elements={messageElements}
                            bind:view={builderView}
                            bind:textOptions
                            sections={commsSections}
                            characters={availableCharacters}
                            faded={id => !isInPlay(id)}
                            reminders={characterRemindersFor(commsCharacterId)}
                            openSections={commsOpenSections}
                            tokenSize={trayTokenSize}
                            imageSize={TRAY_IMAGE_SIZE}
                        />
                        {#if builderView === 'builder'}
                            <button class="button-style highlight" disabled={messageElements.length === 0} onclick={showCustomMessage}>{messageQueue.enabled ? 'Add to queue' : 'Show'}</button>
                        {/if}
                    {/if}
                {/if}
            </div>
        </div>
    {/if}

    <!-- Out here, as a character's preset can be queued from their token or the night order with communications closed -->
    {#if queuedToast !== null}
        <div class="locked-toast queued-toast" role="status" style="z-index: {GRIM_Z.ui + 40};"
            in:fly={{ y: -24, opacity: 0, duration: 300, easing: cubicOut }}
            out:fly={{ y: -24, opacity: 0, duration: 250, easing: cubicIn }}>
            <span>Queued: {queuedToast}</span>
        </div>
    {/if}

    {#if newBluffSet && script}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {GRIM_Z.ui + 20};" onclick={() => newBluffSet = null}>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="overlay-panel" style="width: min(94vw, 720px);" onclick={(e) => e.stopPropagation()}>
                <button class="overlay-close" onclick={() => newBluffSet = null} aria-label="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                <div class="overlay-name dumbledore-font">New bluff set</div>
                <div class="overlay-drag-hint">Choose at least 3 bluffs ({newBluffSet.length} chosen). Faded characters are already in play.</div>
                <div class="picker-grid">
                    {#each sortedScriptCharacters.filter(c => !isSideCategory(c)) as character (character.id)}
                        {@const inPlay = seatedCharacterIdSet.has(character.id) || !!loadedPreset?.character_ids.includes(character.id)}
                        <div style="position: relative;">
                            <button class="no-button-style tray-token" class:picked={newBluffSet.includes(character.id)} class:in-play={inPlay} onclick={() => toggleNewBluff(character.id)}>
                                <CharacterToken {character} style="position: relative;" size="{trayTokenSize}px" imageSize={TRAY_IMAGE_SIZE} norules/>
                            </button>
                            {#if inPlay && newBluffSet.includes(character.id)}<InPlayWarning size="24px" style="position: absolute; bottom: -4px; right: -4px; pointer-events: none;"/>{/if}
                        </div>
                    {/each}
                </div>
                <button class="button-style highlight" disabled={newBluffSet.length < 3} onclick={addBluffSet}>Add bluff set</button>
            </div>
        </div>
    {/if}

    {#if showTimerOptions}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: {GRIM_Z.ui};" onclick={() => {showTimerOptions = false;}} role="dialog" tabindex="0">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div style="position: relative; background: var(--grim-panel-bg); padding: 48px 20px 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px;" onclick={(e) => e.stopPropagation()} >
                <button class="overlay-close" onclick={()=>{showTimerOptions = false;}} aria-label="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                {#if clockClient}
                    <ClockSetter model={clockClient} timerOptions={data.timerOptions} musicPresets={data.musicPresets} spotifyPresets={data.spotifyPresets} onstart={()=>{showTimerOptions = false}} onmixer={() => {showTimerOptions = false; saveGrimoire().then(()=>goto(`/admin/mixer?remote_only=1&back_uri=${encodeURIComponent(location.pathname + location.search)}`))}} onanalysis={(url) => {showTimerOptions = false; saveGrimoire().then(()=>goto(url))}}/>
                {:else}
                    <div>Connecting to clock...</div>
                {/if}
            </div>
        </div>
    {/if}

    {#if showEndGame}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: {GRIM_Z.ui};" onclick={() => {showEndGame = false;}} role="dialog" tabindex="0">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div style="background: var(--grim-panel-bg); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px; max-width: 320px;" onclick={(e) => e.stopPropagation()} >
                <h2 style="margin: 0; padding: 0;">End game</h2>
                <div style="opacity: 0.8;">Who won this game? This clears the grim and cannot be undone.</div>
                <button class="button-style" style="background-color: #b63737; color: #fff; padding: 0.8em 1em;" onclick={() => endGame('evil')}>Evil victory</button>
                <button class="button-style" style="background-color: #2563eb; color: #fff; padding: 0.8em 1em;" onclick={() => endGame('good')}>Good victory</button>
                <button class="button-style" style="padding: 0.8em 1em;" onclick={() => endGame()}>No result</button>
                <button class="button-style" style="padding: 0.8em 1em; margin-top: 10px;" onclick={() => {showEndGame = false;}}>Cancel</button>
            </div>
        </div>
    {/if}

    {#if syncConflict}
        <!-- Can't be dismissed: one or the other has to be chosen -->
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: {GRIM_Z.ui + 50};" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
            <div style="background: var(--grim-panel-bg); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px; max-width: 340px;">
                <h2 id="sync-conflict-title" style="margin: 0; padding: 0;">Unsaved changes</h2>
                <div style="opacity: 0.8;">
                    This device has changes from {formatSaveTime(syncConflict.local)} that never reached the server, but the
                    grimoire was changed on the server since, at {formatSaveTime(syncConflict.server)}. Which version do you
                    want to keep? The other is lost.
                </div>
                <button class="button-style highlight" style="padding: 0.8em 1em;" onclick={() => resolveSyncConflict('local')}>Keep this device's</button>
                <button class="button-style" style="padding: 0.8em 1em;" onclick={() => resolveSyncConflict('server')}>Use the server's</button>
            </div>
        </div>
    {/if}
    </div>
