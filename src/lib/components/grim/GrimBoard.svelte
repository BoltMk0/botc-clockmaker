<script lang="ts">
    import "./grimUi.css";
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { ICON_VIEWBOX, addIcon, chevronLeftIcon, closeIcon, cycleIcon, deleteIcon, editIcon, inkEraserIcon, keyboardArrowDownIcon, keyboardArrowUpIcon, layersClearIcon, lockIcon, lockOpenIcon, menuIcon, smsIcon, undoIcon, visibilityIcon } from "$lib/icons/material.js";
    import { presetDisplayName, type MessagePreset } from "$lib/common/message";
    import type { ReminderToken, ScriptCharacter } from "$lib/resources/common/gameData.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import PlayerToken from "$lib/components/PlayerToken.svelte";
    import PencilIcon from "$lib/components/PencilIcon.svelte";
    import { fetchReminderTokensForCharacter } from "$lib/resources/client/reminderTokens.js";
    import { browser } from "$app/environment";
    import { flushSync, onMount, type Snippet } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { MediaQuery } from "svelte/reactivity";
    import type { CanvasToolType } from "$lib/components/DrawableCanvas2/types.js";
    import AnotatableViewV2 from "$lib/components/DrawableCanvas2/AnotatableViewV2.svelte";
    import { ALIGNMENT_RING_FACTORS, BOARD_TOKEN_SIZE, hasDeadVote, isPlayerToken, layoutTokensAtDefaultPositions, tokensToSeat, type PlacedReminder, type PlacedToken } from "$lib/resources/common/grimoireState.js";
    import type { GrimoireUndo } from "$lib/model/client/GrimoireUndo.svelte";
    import { v7 } from "uuid";
    import GrimPieces from "./GrimPieces.svelte";
    import { FIRST_NIGHT_INFO_ORDERS, GRIM_Z, TRAY_IMAGE_SIZE, blankReminderToken, isSideRoleCategory, type FirstNightInfoStep, type GrimModel } from "./GrimModel.svelte";

    // The grim itself: the tokens, reminders and drawings on the board, which can be panned and zoomed, the token
    // tray to add more from, each token's popup (or summary, on a phone) to change it, the drawing tools, and undo.
    // It changes the grim in `model` in place; the page it's on saves it (onsave) and adds what's its own: things in
    // the sidebar, in the middle of the board, and what's to be done with a character (shown, or communicated).

    // Size of the draggable character token in the character overview overlay
    const OVERLAY_TOKEN_SIZE = 96;
    // Size of the token at the top of a placed token's summary (on a phone)
    const OVERLAY_SUMMARY_TOKEN_SIZE = 120;

    let {
        model,
        undo,
        lockStorageKey,
        night = null,
        firstNightInfo = false,
        onwakenumber,
        onsave,
        onunsaved,
        onshowcharacter,
        comms,
        trayBluffs,
        sidebarTop,
        sidebarMenuStart,
        sidebarMenuEnd,
        topRight,
        centre,
        ignoreGesturesOn = '',
        activeTokenId = $bindable(null),
        dragging: draggingAnything = $bindable(false),
    }: {
        model: GrimModel;
        /** Undo for the changes made here: a step is made each time the grim is saved. */
        undo?: GrimoireUndo;
        /** Where on this device to remember whether the tokens are locked (not remembered without it). */
        lockStorageKey?: string;
        /** The night whose order the players wake in is shown on them, with their wake reminders; none without one. */
        night?: 'first' | 'other' | null;
        /** Whether the Minions and the Demon wake on the first night to learn each other (with enough players), which
         *  is numbered on them in the first night's order. */
        firstNightInfo?: boolean;
        /** When given, tapping a night order number calls it with its wake (the character's id, or "minioninfo" or
         *  "demoninfo") and the number. */
        onwakenumber?: (key: string, number: number) => void;
        /** Called to save the grim after each change (or, while typing or drawing, once it's settled). */
        onsave?: () => void | Promise<void>;
        /** Called when the grim has changed and is waiting to be saved. */
        onunsaved?: () => void;
        /** Shows a character (to a player); without it, there's no Show button. */
        onshowcharacter?: (characterId: string) => void;
        /** A character's communications for the night; without it, there's no Comms button. */
        comms?: {
            presetsFor: (characterId: string) => MessagePreset[];
            showPreset: (preset: MessagePreset, characterId: string) => void;
            openPresetComms: (characterId: string) => void;
        };
        /** A section of the token tray above the script's, for the game's bluffs. */
        trayBluffs?: { count: number; content: Snippet };
        /** Buttons in the sidebar's top row, after the one opening its menu. */
        sidebarTop?: Snippet;
        /** Buttons at the start and end of the sidebar's menu. */
        sidebarMenuStart?: Snippet;
        sidebarMenuEnd?: Snippet;
        /** Buttons in the top right corner, after the undo button (which --grim-undo-right moves clear of them). */
        topRight?: Snippet;
        /** Shown in the middle of the board, zooming with it (e.g. the clock). */
        centre?: Snippet;
        /** Selectors for elements outside the board over which the board mustn't be panned or drawn on. */
        ignoreGesturesOn?: string;
        /** The token whose popup (or summary) is open. */
        activeTokenId?: string | null;
        /** Whether a token or reminder is being dragged, for the page to hide its own controls. */
        dragging?: boolean;
    } = $props();

    const grim = $derived(model.grim);
    const placedTokens = $derived(model.placedTokens);
    const placedReminders = $derived(model.placedReminders);
    const characterById = $derived(model.characterById);

    // Pinch-zoom / pan of the board (bound to the annotatable view; also works outside draw mode)
    let viewScale = $state(1);
    let viewTx = $state(0);
    let viewTy = $state(0);
    const canvasLayers = $derived(grim.present.canvas.layers);
    let activeCanvasLayerIndex = $state<number>(0);
    // Another device (or an undo) can take away layers
    $effect(() => {
        if (activeCanvasLayerIndex > canvasLayers.length - 1) activeCanvasLayerIndex = Math.max(0, canvasLayers.length - 1);
    });
    let sidebarOpen = $state(false);
    // Board token size in board px; the zoom does the fitting to the screen.
    const tokenSize = BOARD_TOKEN_SIZE;
    const reminderTokenSize = Math.round(tokenSize * 0.56);
    // The reminders in a token's popup: smaller than on the board, in columns as tall as the name/buttons beside them
    const popupReminderSize = Math.round(tokenSize * 0.35);
    const POPUP_REMINDER_GAP = 4;
    let popupMetaHeight = $state(0);
    const popupReminderRows = $derived(Math.max(1, Math.floor((popupMetaHeight + POPUP_REMINDER_GAP) / (popupReminderSize + POPUP_REMINDER_GAP))));
    // Phone-width screen: tapping a token opens a full-screen summary, not a popup.
    const mobileQuery = new MediaQuery('(max-width: 768px)', false);
    const isMobile = $derived(mobileQuery.current);
    // Slightly smaller in the tray on a phone so more tokens fit per row.
    const trayTokenSize = $derived(Math.max(40, Math.round(tokenSize * 0.53 * (isMobile ? 0.8 : 1))));

    // Cache of fetched reminder tokens per character
    let reminderCache = $state<Record<string, ReminderToken[]>>({});

    // Where the active token's popup is (relative to the board's root), and whether it's above the token
    let activeReminderPos = $state<{ x: number; y: number } | null>(null);
    let activeReminderAbove = $state(false);
    let reminderPopupEl = $state<HTMLDivElement | null>(null);
    const activeToken = $derived<PlacedToken | null>(
        activeTokenId === null ? null : (placedTokens.find(t => t.id === activeTokenId) ?? null)
    );
    const activeCharacterId = $derived(activeToken?.characterId ?? null);

    // "Change character" only offers loric/fabled when swapping an existing loric/fabled token (never for a player
    // token), since loric/fabled can never be a player character.
    const pickableCharacters = $derived(
        activeToken && model.isSideRoleToken(activeToken)
            ? model.sortedScriptCharacters.filter(c => isSideRoleCategory(c.category))
            : model.sortedScriptCharacters.filter(c => !isSideRoleCategory(c.category))
    );

    const tools: CanvasToolType[] = [
        { type: 'pen', color: '#dddddd', width: 1.5 },
        { type: 'pen', color: '#111111', width: 1.5 },
        { type: 'pen', color: '#e74c3c', width: 1.5 },
        { type: 'pen', color: '#27ae60', width: 1.5 },
        { type: 'pen', color: '#2980b9', width: 1.5 },
        { type: 'pen', color: '#f1c40f', width: 1.5 },
        { type: 'eraser', width: 4 }
    ];

    let activeToolIndex = $state<number>(0);
    let activeTool = $derived(tools[activeToolIndex]);
    // A stylus draws even outside draw mode, with the last pen picked (never the eraser).
    let lastPenTool = $state<CanvasToolType>(tools[0]);
    $effect(() => {
        if (activeTool.type === 'pen') lastPenTool = activeTool;
    });
    // A stylus's eraser end erases, and its side button toggles it to the eraser.
    const penEraserTool = tools.find(t => t.type === 'eraser') ?? null;

    // NIGHT ORDER
    const nightOrderOf = $derived(night === 'other' ? (c: ScriptCharacter) => c.scriptOtherNightOrder : (c: ScriptCharacter) => c.scriptFirstNightOrder);
    const nightOrderByCharacterId = $derived(night === null ? [] : (placedTokens
        .filter(model.wakesInNightOrder)
        .map(c => characterById.get(c.characterId ?? ''))
        .filter(c => c !== undefined)
        .map(c => [c.id, nightOrderOf(c)])
        .filter(([_, order]) => order !== null) as [string, number][]).sort((a, b) => a[1] - b[1])
        .map(([id, _]) => id));
    // The night's wakes in order: the characters' (by id) and, on the first night with firstNightInfo, the Minion Info
    // and Demon Info steps, each before the first waking character whose canonical first night order comes after it
    // (as on the night order sheet).
    const infoWake = (step: FirstNightInfoStep) => `info:${step}`;
    const ordinalSuffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
    const wakeSequence = $derived.by(() => {
        const sequence = [...nightOrderByCharacterId];
        if (night !== 'first' || !firstNightInfo) return sequence;
        for (const [step, at] of Object.entries(FIRST_NIGHT_INFO_ORDERS) as [FirstNightInfoStep, number][]) {
            let insertAt = sequence.findIndex(id => {
                const order = characterById.get(id)?.firstNightOrder;
                return order !== null && order !== undefined && order > at;
            });
            if (insertAt === -1) insertAt = sequence.length;
            sequence.splice(insertAt, 0, infoWake(step));
        }
        return sequence;
    });
    // A token's wakes in the night's order (their numbers, and what wakes: the character's id or the info step's),
    // earliest first: its character's wake while it still wakes, and, for a seated Minion or Demon still alive, its
    // Minion Info or Demon Info wake.
    function wakeNumbersOf(token: PlacedToken): { number: number; key: string }[] {
        const numbers: { number: number; key: string }[] = [];
        if (!token.characterId || !characterById.has(token.characterId)) return numbers;
        const own = model.wakesInNightOrder(token) ? wakeSequence.indexOf(token.characterId) : -1;
        if (own >= 0) numbers.push({ number: own + 1, key: token.characterId });
        const category = characterById.get(token.characterId)?.category;
        const step: FirstNightInfoStep | null = category === 'minion' ? 'minioninfo' : category === 'demon' ? 'demoninfo' : null;
        if (step && !token.isDead && model.seatedTokenIds.has(token.id)) {
            const info = wakeSequence.indexOf(infoWake(step));
            if (info >= 0) numbers.push({ number: info + 1, key: step });
        }
        return numbers.sort((a, b) => a.number - b.number);
    }

    let showFooter = $state(false);
    // svelte-ignore state_referenced_locally
    let tokensLocked = $state(browser && lockStorageKey ? localStorage.getItem(lockStorageKey) === 'true' : false);
    let editing = $state(false);

    // When annotate mode is entered: hide tray
    $effect(() => { if (editing) showFooter = false; });

    // Keep the popup on-screen horizontally by clamping its x after measuring its rendered width.
    $effect(() => {
        if (activeTokenId === null || !activeReminderPos || !reminderPopupEl || !rootEl) return;
        // Touch reactive content so the effect re-runs when the popup's contents (and thus width) change.
        void (activeCharacterId && reminderCache[activeCharacterId]);
        void activeToken?.playerName;
        void activeToken?.isDead;
        void activeToken?.alignment;
        void playerCommsShown;
        const popupRect = reminderPopupEl.getBoundingClientRect();
        const margin = 8;
        const halfWidth = popupRect.width / 2;
        const minX = halfWidth + margin;
        const maxX = rootEl.clientWidth - halfWidth - margin;
        if (maxX < minX) return;
        const clampedX = Math.max(minX, Math.min(maxX, activeReminderPos.x));
        if (clampedX !== activeReminderPos.x) {
            activeReminderPos = { ...activeReminderPos, x: clampedX };
        }
    });

    // Close the reminder popup when tapping anywhere outside a board token, the popup itself, or a board reminder.
    $effect(() => {
        if (activeTokenId === null) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.board-token, .reminder-popup, .board-reminder, .character-overlay, .wake-toggle')) return;
            closeReminderTray();
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    });

    // Close the token tray when tapping anywhere outside of it (or its opening button).
    $effect(() => {
        if (!showFooter) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.grimoire-footer, .open-tray-btn, .character-overlay')) return;
            showFooter = false;
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    });

    // SAVING
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    // A line is being drawn on the canvas (from its first change to its commit). In case a stroke is abandoned
    // without a commit (e.g. it turned into a pinch), it also counts as finished after a while with no change.
    let drawingStroke = false;
    let drawingStrokeTimer: ReturnType<typeof setTimeout> | null = null;

    /** Whether a token or reminder is being dragged, or a line drawn: the grim isn't as it will be until it's done. */
    export function isBusy(): boolean {
        return dragging !== null || draggingReminder !== null || drawingStroke;
    }

    /** Whether a change is waiting (for typing to stop) to be saved. */
    export function hasPendingSave(): boolean {
        return saveTimer !== null;
    }

    /** Forgets a change waiting to be saved, without saving it. */
    export function cancelPendingSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = null;
    }

    /** Saves the grim now, as a step to undo. */
    export async function save() {
        cancelPendingSave();
        // Not mid-drag (the dragged token or reminder is off the board until it's dropped) or mid-line
        if (!isBusy()) undo?.checkpoint();
        await onsave?.();
    }

    // Saves once typing has stopped for a second.
    function saveSoon() {
        onunsaved?.();
        cancelPendingSave();
        saveTimer = setTimeout(() => {
            saveTimer = null;
            // Don't persist a half-finished drag (the dragged token is temporarily removed from state)
            if (dragging || draggingReminder) {
                saveSoon();
                return;
            }
            save();
        }, 1000);
    }

    function onCanvasChange() {
        drawingStroke = true;
        onunsaved?.();
        if (drawingStrokeTimer) clearTimeout(drawingStrokeTimer);
        drawingStrokeTimer = setTimeout(onCanvasCommit, 5000);
    }

    function onCanvasCommit() {
        if (drawingStrokeTimer) clearTimeout(drawingStrokeTimer);
        drawingStrokeTimer = null;
        drawingStroke = false;
        save();
    }

    function undoLastChange() {
        closeReminderTray();
        if (undo?.undo()) save();
    }

    function setTokensLocked(val: boolean) {
        tokensLocked = val;
        if (tokensLocked) showFooter = false;
        if (browser && lockStorageKey) localStorage.setItem(lockStorageKey, String(val));
    }

    function toggleTray() {
        showFooter = !showFooter;
        if (showFooter) {
            setTokensLocked(false);
            editing = false;
        }
    }

    async function loadRemindersForCharacter(characterId: string): Promise<ReminderToken[]> {
        if (reminderCache[characterId]) return reminderCache[characterId];
        const tokens = await fetchReminderTokensForCharacter(characterId);
        // The blank token is only a fallback for characters with no reminders of their own
        reminderCache[characterId] = tokens.length > 0 ? tokens : [blankReminderToken(characterId)];
        return reminderCache[characterId];
    }

    // The collapsible tray sections that are open, by key. They start collapsed; which are open is remembered on this
    // device (for every game, as the sections are the scripts).
    const TRAY_EXPANDED_KEY = 'grimoire-tray-expanded';
    let expandedTraySections = $state<string[]>(browser ? (() => {
        try {
            const saved = JSON.parse(localStorage.getItem(TRAY_EXPANDED_KEY) ?? '[]');
            return Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : [];
        } catch {
            return [];
        }
    })() : []);

    function toggleTraySection(key: string) {
        expandedTraySections = expandedTraySections.includes(key)
            ? expandedTraySections.filter(k => k !== key)
            : [...expandedTraySections, key];
        try {
            localStorage.setItem(TRAY_EXPANDED_KEY, JSON.stringify(expandedTraySections));
        } catch {
            // Only a convenience
        }
    }

    let dragging = $state<{ character: ScriptCharacter | null; source: 'tray' | 'board'; sourceToken?: PlacedToken } | null>(null);
    let draggingReminder = $state<{ token: ReminderToken; characterId: string; source: 'popup' | 'board' } | null>(null);
    $effect(() => { draggingAnything = dragging !== null || draggingReminder !== null; });
    let ghostPos = $state<{ x: number; y: number } | null>(null);
    let dragOffset = $state<{ x: number; y: number }>({ x: 0, y: 0 });
    let rootEl = $state<HTMLDivElement | null>(null);
    let boardEl = $state<HTMLDivElement | null>(null);
    let footerEl = $state<HTMLDivElement | null>(null);

    // Edge threshold in px for deleting reminder tokens
    const EDGE_THRESHOLD = 60;

    // Distinguish tap vs drag
    let pointerStartPos: { x: number; y: number } | null = null;
    let pointerStartToken: PlacedToken | null = null;
    const TAP_THRESHOLD = 10;

    // Spaces the players evenly round the middle guide ring in their current order (the outer one with more than 15
    // of them): the named tokens, or every token while none are named. Unnamed tokens (while some are named) and
    // reminders rotate with the nearest player, and loric and fabled stay put.
    const AUTO_ARRANGE_OUTER_RING_OVER = 15;
    function autoArrangeTokens() {
        const players = tokensToSeat(placedTokens, model.isSideRoleToken);
        if (players.length === 0) return;
        closeReminderTray();
        const ringIndex = players.length > AUTO_ARRANGE_OUTER_RING_OVER ? 2 : 1;
        const laidOut = layoutTokensAtDefaultPositions(placedTokens, placedReminders, model.isSideRoleToken, tokenSize * ALIGNMENT_RING_FACTORS[ringIndex]);
        grim.present.placedTokens = laidOut.tokens;
        grim.present.placedReminders = laidOut.reminders;
        save();
        fitView();
    }

    // Zoom so the placed tokens fill the screen, edge to edge, with the town centred (rings, reminders, the clock, loric/fabled and unnamed tokens are ignored).
    const FIT_PADDING = 8;
    const FIT_MAX_SCALE = 4;
    export function fitView() {
        if (!boardEl) return;
        // Half-extents of the framed tokens about the board's centre (0, 0): the view is centred on the centre of the
        // town circle, not on the bounding box of whatever tokens happen to be placed, so the town sits mid-screen.
        let halfW = 0, halfH = 0;
        // Only seated players count: loric/fabled and other character tokens with no player name are ignored.
        const framed = placedTokens.filter(t => isPlayerToken(t) && !model.isSideRoleToken(t));
        const tokens = framed.length > 0 ? framed : placedTokens;
        for (const t of tokens) {
            halfW = Math.max(halfW, Math.abs(t.x) + tokenSize / 2);
            halfH = Math.max(halfH, Math.abs(t.y) + tokenSize / 2);
        }
        if (tokens.length === 0) { viewScale = 1; viewTx = 0; viewTy = 0; return; }

        const availW = Math.max(1, boardEl.offsetWidth - FIT_PADDING * 2);
        const availH = Math.max(1, boardEl.offsetHeight - FIT_PADDING * 2);
        viewScale = Math.min(FIT_MAX_SCALE, availW / (halfW * 2), availH / (halfH * 2));
        // Screen position = centre + translate + scale * world, so no translation keeps the board's centre on screen centre.
        viewTx = 0;
        viewTy = 0;
    }

    // A second finger landed: whatever tap/drag the first finger was starting is now part of a pinch instead.
    function cancelPendingBoardTap() {
        pointerStartPos = null;
        pointerStartToken = null;
    }

    // Character overview opened by tapping a token in the tray
    let overlayOpen = $state(false);
    let overlayCharacter = $state<ScriptCharacter | null>(null);
    // True when the overlay was opened from a token on the board (adds the alive/good/name controls, drops the character token).
    let overlayFromBoard = $state(false);

    function openCharacterOverlay(character: ScriptCharacter | null, fromBoard = false) {
        overlayOpen = true;
        overlayCharacter = character;
        overlayFromBoard = fromBoard;
        if (character) loadRemindersForCharacter(character.id).then(() => { reminderCache = reminderCache; });
    }

    /** Keyboard equivalent of a click for non-button elements with role="button": Enter or Space activates. */
    function onActivateKey(e: KeyboardEvent, activate: () => void) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // Space would otherwise scroll
        activate();
    }

    function closeOverlay() {
        overlayOpen = false;
        overlayCharacter = null;
        pickingCharacter = false;
        overlayFromBoard = false;
        closeReminderTray();
    }

    // Dragged with a finger, a token rides just above it rather than under it, so it can be seen where it's going (and
    // where it'll land: a drop goes where the token is drawn). It's picked up where it was grabbed (`grab`: the pointer
    // less the token's centre) and glides up over the finger; a mouse or pen holds it where it's grabbed. `size` is the
    // dragged token's size on screen. Returns the offset to start the drag with.
    const LIFT_MS = 180;
    let liftFrame: number | null = null;

    function pickUpOffset(pointerType: string, size: number, grab: { x: number; y: number }): { x: number; y: number } {
        if (liftFrame !== null) cancelAnimationFrame(liftFrame);
        liftFrame = null;
        if (pointerType !== 'touch') return grab;
        const lifted = { x: 0, y: Math.min(size / 2, 90) + 20 };
        const start = performance.now();
        const step = (now: number) => {
            // Dropped (or cancelled) part way up
            if (!ghostPos || (!dragging && !draggingReminder)) {
                liftFrame = null;
                return;
            }
            const t = Math.min(1, (now - start) / LIFT_MS);
            const eased = 1 - (1 - t) ** 3;
            const pointer = { x: ghostPos.x + dragOffset.x, y: ghostPos.y + dragOffset.y };
            dragOffset = { x: grab.x + (lifted.x - grab.x) * eased, y: grab.y + (lifted.y - grab.y) * eased };
            ghostPos = { x: pointer.x - dragOffset.x, y: pointer.y - dragOffset.y };
            liftFrame = t < 1 ? requestAnimationFrame(step) : null;
        };
        liftFrame = requestAnimationFrame(step);
        return grab;
    }
    const characterGhostSize = () => tokenSize * viewScale;
    const reminderGhostSize = () => reminderTokenSize * viewScale;

    // The moment a drag starts from the overlay, get the tray and overlay out of the way so the grim shows.
    function startDragCharacterFromOverlay(e: PointerEvent, character: ScriptCharacter) {
        startDragFromTray(e, character);
        dragOffset = pickUpOffset(e.pointerType, characterGhostSize(), { x: 0, y: 0 });
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        overlayOpen = false;
        overlayCharacter = null;
        showFooter = false;
    }

    function startDragReminderFromOverlay(e: PointerEvent, token: ReminderToken, characterId: string) {
        e.preventDefault();
        e.stopPropagation();
        closeReminderTray();
        dragOffset = pickUpOffset(e.pointerType, reminderGhostSize(), { x: 0, y: 0 });
        draggingReminder = { token, characterId, source: 'popup' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        overlayOpen = false;
        overlayCharacter = null;
        showFooter = false;
    }

    // Whether the player info (the token popup, or the overlay on mobile) is listing the character's presets for
    // tonight in place of its buttons. With only one, it's shown straight away, and with no presets of their own,
    // communications' Preset tab is opened instead.
    let playerCommsShown = $state(false);
    $effect(() => {
        void activeTokenId; void overlayOpen;
        playerCommsShown = false;
    });
    function openPlayerComms(characterId: string) {
        if (!comms) return;
        const presets = comms.presetsFor(characterId);
        if (presets.length === 0) comms.openPresetComms(characterId);
        else if (presets.length === 1) comms.showPreset(presets[0], characterId);
        else playerCommsShown = true;
    }

    // The board's centre on screen
    function boardCentre(): { x: number; y: number } {
        const rect = boardEl!.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function startDragFromTray(e: PointerEvent, character: ScriptCharacter) {
        e.preventDefault();
        closeReminderTray();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = pickUpOffset(e.pointerType, characterGhostSize(), { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) });
        dragging = { character, source: 'tray' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    }

    // A token can be picked straight up out of the tray, without going through its overview, and the tray closes so
    // it can be put on the grim. With a finger (or pen), by pressing and holding it: one that moves before the hold is up
    // is scrolling the tray instead. With a mouse, by dragging it at all. A plain tap or click still opens the overview.
    const TRAY_HOLD_MS = 400;
    type TrayHold = { pointerId: number; character: ScriptCharacter; start: { x: number; y: number }; last: { x: number; y: number };
        pointerType: string; grab: { x: number; y: number }; timer: ReturnType<typeof setTimeout> | null };
    let trayHold: TrayHold | null = null;
    // The click that follows letting go of a held token mustn't also open its overview.
    let suppressTrayClick = false;

    function startTrayHold(e: PointerEvent, character: ScriptCharacter) {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        cancelTrayHold();
        suppressTrayClick = false;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const hold: TrayHold = {
            pointerId: e.pointerId,
            character,
            start: { x: e.clientX, y: e.clientY },
            last: { x: e.clientX, y: e.clientY },
            pointerType: e.pointerType,
            grab: { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) },
            // A mouse picks it up as soon as it moves instead (see onPointerMove)
            timer: e.pointerType === 'mouse' ? null : setTimeout(() => pickUpFromTray(hold), TRAY_HOLD_MS)
        };
        trayHold = hold;
    }

    function pickUpFromTray(hold: TrayHold) {
        cancelTrayHold();
        suppressTrayClick = true;
        closeReminderTray();
        dragOffset = pickUpOffset(hold.pointerType, characterGhostSize(), hold.grab);
        dragging = { character: hold.character, source: 'tray' };
        ghostPos = { x: hold.last.x - dragOffset.x, y: hold.last.y - dragOffset.y };
        // It's going on the grim: the tray stays closed once it's dropped
        showFooter = false;
        if (hold.pointerType !== 'mouse') navigator.vibrate?.(15);
    }

    function cancelTrayHold() {
        if (trayHold?.timer) clearTimeout(trayHold.timer);
        trayHold = null;
    }

    function onTrayTokenClick(character: ScriptCharacter) {
        if (suppressTrayClick) {
            suppressTrayClick = false;
            return;
        }
        openCharacterOverlay(character);
    }

    function startDragFromBoard(e: PointerEvent, token: PlacedToken) {
        e.preventDefault();
        // While the tokens are locked, a tap still opens the popup, but a drag doesn't move the token
        pointerStartPos = { x: e.clientX, y: e.clientY };
        pointerStartToken = token;
    }

    // A toast saying why a token won't move, when one is dragged while they're locked
    const LOCKED_TOAST_MS = 1800;
    let lockedToastVisible = $state(false);
    let lockedToastTimer: ReturnType<typeof setTimeout> | null = null;
    function showLockedToast() {
        lockedToastVisible = true;
        if (lockedToastTimer !== null) clearTimeout(lockedToastTimer);
        lockedToastTimer = setTimeout(() => { lockedToastVisible = false; lockedToastTimer = null; }, LOCKED_TOAST_MS);
    }
    $effect(() => () => { if (lockedToastTimer !== null) clearTimeout(lockedToastTimer); });

    function actuallyStartBoardDrag(e: PointerEvent, token: PlacedToken) {
        if (tokensLocked) {
            showLockedToast();
            return;
        }
        if (!boardEl) return;

        const character = characterById.get(token.characterId ?? '') ?? null;
        if (token.characterId !== null && !character) {
            console.error("Character not found for token:", token);
            return;
        }

        closeReminderTray();
        const centre = boardCentre();
        const tokenScreenX = centre.x + token.x * viewScale;
        const tokenScreenY = centre.y + token.y * viewScale;
        dragOffset = pickUpOffset(e.pointerType, characterGhostSize(), { x: e.clientX - tokenScreenX, y: e.clientY - tokenScreenY });
        dragging = { character: character, source: 'board', sourceToken: token };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        grim.present.placedTokens = placedTokens.filter(t => t !== token);
    }

    function startDragReminderFromPopup(e: PointerEvent, token: ReminderToken) {
        e.preventDefault();
        e.stopPropagation();
        if (activeCharacterId === null) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = pickUpOffset(e.pointerType, reminderGhostSize(), { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) });
        draggingReminder = { token, characterId: activeCharacterId, source: 'popup' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        closeReminderTray();
    }

    function startDragReminderFromBoard(e: PointerEvent, reminder: PlacedReminder) {
        e.preventDefault();
        e.stopPropagation();
        closeReminderTray();

        const token = model.reminderById[reminder.tokenId];
        if (!token) {
            console.error("Reminder token not found for placed reminder:", reminder);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = pickUpOffset(e.pointerType, reminderGhostSize(), { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) });
        draggingReminder = { token, characterId: token.characterId, source: 'board' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        grim.present.placedReminders = placedReminders.filter(r => !(r.tokenId === reminder.tokenId && r.x === reminder.x && r.y === reminder.y));
    }

    async function toggleReminderTray(token: PlacedToken) {
        const character = characterById.get(token.characterId ?? '') ?? null;
        if (isMobile) {
            // The alive/good/name handlers work off the active token, so mark it active without showing the popup.
            activeTokenId = token.id;
            activeReminderPos = null;
            openCharacterOverlay(character, true);
            return;
        }
        if (activeTokenId === token.id) {
            closeReminderTray();
            return;
        }
        activeTokenId = token.id;
        if (!boardEl || !rootEl) return;
        // The token's centre, relative to the board's root (which the popup is placed in)
        const centre = boardCentre();
        const root = rootEl.getBoundingClientRect();
        const x = centre.x - root.left + token.x * viewScale;
        const y = centre.y - root.top + token.y * viewScale;
        // Above or below the token, a small gap from its edge
        const gap = 10;
        const halfToken = (tokenSize / 2) * viewScale;
        activeReminderAbove = token.y > 0;
        activeReminderPos = { x, y: activeReminderAbove ? y - halfToken - gap : y + halfToken + gap };
        if (token.characterId !== null) {
            await loadRemindersForCharacter(token.characterId);
            reminderCache = reminderCache; // trigger reactivity
        }
    }

    // Changes the active token, and saves it.
    function updateActiveToken(change: (t: PlacedToken) => PlacedToken, saveNow = true) {
        if (!activeToken) return;
        const target = activeToken;
        grim.present.placedTokens = grim.present.placedTokens.map(t => t === target ? change(t) : t);
        if (saveNow) save();
        else saveSoon();
    }

    const toggleAlive = () => updateActiveToken(t => ({ ...t, isDead: !t.isDead }));
    const toggleDeadVote = () => updateActiveToken(t => ({ ...t, deadVoteUsed: !t.deadVoteUsed }));
    const toggleAlignment = () => updateActiveToken(t => ({ ...t, alignment: t.alignment === 'evil' ? 'good' : 'evil' }));
    const toggleCustomWake = () => updateActiveToken(t => ({ ...t, customWake: !t.customWake }));
    const setPlayerName = (name: string) => updateActiveToken(t => ({ ...t, playerName: name }), false);

    // Gives the active player a different character (or none), keeping their name, seat and life status.
    let pickingCharacter = $state(false);

    function setCharacter(characterId: string | null) {
        if (!activeToken) return;
        const target = activeToken;
        grim.present.placedTokens = grim.present.placedTokens.map(t =>
            t === target ? { ...t, characterId, alignment: model.defaultAlignmentFor(characterId) } : t
        );
        if (characterId) loadRemindersForCharacter(characterId).then(() => { reminderCache = reminderCache; });
        closeOverlay();
        closeReminderTray();
        save();
    }

    /** Closes the open token's popup. */
    export function closeReminderTray() {
        activeTokenId = null;
        activeReminderPos = null;
    }

    // The popup's player name is shown as text until its edit button is pressed.
    let editingPlayerName = $state(false);
    let playerNameInput = $state<HTMLInputElement | null>(null);

    // Each token's popup opens not editing the name
    $effect(() => {
        void activeTokenId;
        editingPlayerName = false;
    });

    function startEditingPlayerName() {
        editingPlayerName = true;
        // Rendered and focused in the same tap, or iOS won't raise the keyboard. All selected, so typing replaces it.
        flushSync();
        playerNameInput?.focus();
        playerNameInput?.select();
    }

    // The edge zone a dragged token dropped now would be taken off the board in, if any: where it's drawn (`ghost`) or
    // where the pointer holding it is is in the top or bottom zone of the board's root. (Both, as a token lifted above
    // a finger can't reach the bottom zone itself.)
    function deleteEdgeFor(ghost: { x: number; y: number }): 'top' | 'bottom' | null {
        if (!rootEl) return null;
        const root = rootEl.getBoundingClientRect();
        const pointer = { x: ghost.x + dragOffset.x, y: ghost.y + dragOffset.y };
        for (const p of [ghost, pointer]) {
            if (p.y < root.top + EDGE_THRESHOLD) return 'top';
            if (p.y > root.bottom - EDGE_THRESHOLD) return 'bottom';
        }
        return null;
    }

    function onPointerMove(e: PointerEvent) {
        if (trayHold && e.pointerId === trayHold.pointerId) {
            trayHold.last = { x: e.clientX, y: e.clientY };
            if (Math.abs(e.clientX - trayHold.start.x) > TAP_THRESHOLD || Math.abs(e.clientY - trayHold.start.y) > TAP_THRESHOLD) {
                // A mouse is dragging the token out of it; a finger is scrolling the tray
                if (trayHold.pointerType === 'mouse') pickUpFromTray(trayHold);
                else cancelTrayHold();
            }
            return;
        }
        // Check if we should transition from tap-detection to drag
        if (pointerStartPos && pointerStartToken) {
            const dx = e.clientX - pointerStartPos.x;
            const dy = e.clientY - pointerStartPos.y;
            if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
                actuallyStartBoardDrag(e, pointerStartToken);
                pointerStartPos = null;
                pointerStartToken = null;
            }
            return;
        }

        if (!dragging && !draggingReminder) return;
        e.preventDefault();
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    }

    function onPointerUp(e: PointerEvent) {
        cancelTrayHold();
        // Handle tap on board token
        if (pointerStartPos && pointerStartToken) {
            const dx = e.clientX - pointerStartPos.x;
            const dy = e.clientY - pointerStartPos.y;
            if (Math.abs(dx) <= TAP_THRESHOLD && Math.abs(dy) <= TAP_THRESHOLD) {
                toggleReminderTray(pointerStartToken);
            }
            pointerStartPos = null;
            pointerStartToken = null;
            return;
        }

        // Handle reminder token drop
        if (draggingReminder) {
            if (boardEl && deleteEdgeFor({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }) === null) {
                const centre = boardCentre();
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = (dropX - centre.x) / viewScale;
                const y = (dropY - centre.y) / viewScale;
                grim.present.placedReminders = [...placedReminders, { tokenId: draggingReminder.token.id, x, y }];
            }
            // If near edge, it's deleted (not re-added)
            draggingReminder = null;
            ghostPos = null;
            save();
            return;
        }

        if (!dragging) return;

        if (boardEl && rootEl) {
            const centre = boardCentre();
            const footerRect = footerEl?.getBoundingClientRect();
            const isOverFooter = footerRect && (
                e.clientX >= footerRect.left && e.clientX <= footerRect.right &&
                e.clientY >= footerRect.top && e.clientY <= footerRect.bottom
            );
            // The board rect grows/shrinks with zoom, so test against the root rather than the board.
            const root = rootEl.getBoundingClientRect();
            const isOverBoard = !isOverFooter && (
                e.clientX >= root.left && e.clientX <= root.right &&
                e.clientY >= root.top && e.clientY <= root.bottom
            );

            if (isOverBoard && deleteEdgeFor({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }) === null) {
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = (dropX - centre.x) / viewScale;
                const y = (dropY - centre.y) / viewScale;
                const newPlacedToken: PlacedToken = dragging.sourceToken
                    ? { ...dragging.sourceToken, x, y }
                    : {
                        id: v7(),
                        characterId: dragging.character?.id ?? null,
                        x, y,
                        isDead: false,
                        alignment: model.defaultAlignmentFor(dragging.character?.id ?? null),
                    };
                grim.present.placedTokens = [...grim.present.placedTokens, newPlacedToken];
            }
            // If near edge or over footer: token returns to tray (not re-added)
        }

        dragging = null;
        ghostPos = null;
        save();
    }

    // The browser took the pointer for itself (e.g. to scroll): a held tray token isn't picked up, and one already
    // picked up from the tray goes back to it.
    function onPointerCancel() {
        cancelTrayHold();
        if (dragging?.source === 'tray') {
            dragging = null;
            ghostPos = null;
        }
    }

    // Once a tray token has been picked up, the finger moving mustn't scroll the tray (or the page) instead of
    // dragging it. (Passive listeners can't stop that, hence one added by hand.)
    function preventScrollWhileDragging(e: TouchEvent) {
        if (dragging?.source === 'tray') e.preventDefault();
    }

    onMount(() => {
        document.addEventListener('touchmove', preventScrollWhileDragging, { passive: false });
        fitView();

        // Refit the zoom when the screen space changes (rotation, window resize). Only the board's layout size is
        // observed, so pinch-zoom (a transform) doesn't trigger it; skip the observer's initial callback.
        let lastBoardSize = boardEl ? `${boardEl.offsetWidth}x${boardEl.offsetHeight}` : '';
        const boardResizeObserver = new ResizeObserver(() => {
            if (!boardEl) return;
            const size = `${boardEl.offsetWidth}x${boardEl.offsetHeight}`;
            if (size === lastBoardSize) return;
            lastBoardSize = size;
            fitView();
        });
        if (boardEl) boardResizeObserver.observe(boardEl);

        return () => {
            if (liftFrame !== null) cancelAnimationFrame(liftFrame);
            if (drawingStrokeTimer) clearTimeout(drawingStrokeTimer);
            document.removeEventListener('touchmove', preventScrollWhileDragging);
            cancelTrayHold();
            boardResizeObserver.disconnect();
            cancelPendingSave();
        };
    });

    function clearLayer(index: number) {
        grim.present.canvas.layers = grim.present.canvas.layers.map((layer, i) => i === index ? { strokes: [] } : layer);
        save();
    }

    function addLayer() {
        grim.present.canvas.layers.push({ strokes: [] });
        activeCanvasLayerIndex = grim.present.canvas.layers.length - 1;
        save();
    }

    function deleteLayer(index: number) {
        if (grim.present.canvas.layers.length <= 1) {
            alert("Cannot delete the last layer.");
            return;
        }
        grim.present.canvas.layers = grim.present.canvas.layers.filter((_, i) => i !== index);
        if (activeCanvasLayerIndex >= grim.present.canvas.layers.length) {
            activeCanvasLayerIndex = grim.present.canvas.layers.length - 1;
        }
        save();
    }
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerCancel}/>

{#snippet commsIcon()}
    <svg class="button-icon" viewBox={ICON_VIEWBOX} aria-hidden="true" fill="currentColor"><path d={smsIcon}/></svg>
{/snippet}
{#snippet eyeIcon()}
    <svg class="button-icon" viewBox={ICON_VIEWBOX} aria-hidden="true" fill="currentColor"><path d={visibilityIcon}/></svg>
{/snippet}
<!-- A night order number; tapped, it shows what wakes then (with onwakenumber) -->
{#snippet wakeNumberBadge(wake: { number: number; key: string }, style: string)}
    {#if onwakenumber}
    <button type="button" class="night-order-badge wake-number" class:info-wake={wake.key in FIRST_NIGHT_INFO_ORDERS} {style} onclick={(e) => { e.stopPropagation(); onwakenumber(wake.key, wake.number); }}
        title="What wakes {wake.number}{ordinalSuffix(wake.number)}" aria-label="Wakes {wake.number}{ordinalSuffix(wake.number)}">{wake.number}</button>
    {:else}
    <div class="night-order-badge" class:info-wake={wake.key in FIRST_NIGHT_INFO_ORDERS} {style}>{wake.number}</div>
    {/if}
{/snippet}

{#snippet wakeToggle(on: boolean, style: string, onclick: (e: MouseEvent) => void)}
    <button type="button" class="night-order-badge wake-toggle" class:off={!on} {style} {onclick}
        title={on ? 'Remove the wake reminder' : 'Add a wake reminder, to wake them tonight'}
        aria-label={on ? 'Remove the wake reminder' : 'Add a wake reminder'} aria-pressed={on}>?</button>
{/snippet}

<div class="grim-board-root grim-ui" bind:this={rootEl}>
    {#if undo?.canUndo}
    <!-- Undo this device's last change -->
    <button class="sidebar-btn undo-stroke-btn" class:drag-hidden={draggingAnything} style="z-index: {GRIM_Z.ui};" onclick={undoLastChange} title="Undo" aria-label="Undo">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={undoIcon}/></svg>
    </button>
    {/if}
    {@render topRight?.()}

    {#if lockedToastVisible}
    <div class="locked-toast" role="status" style="z-index: {GRIM_Z.ui + 40};"
        in:fly={{ y: -24, opacity: 0, duration: 300, easing: cubicOut }}
        out:fly={{ y: -24, opacity: 0, duration: 250, easing: cubicIn }}>
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={lockIcon}/></svg>
        <span>Grimoire Tokens Locked</span>
    </div>
    {/if}

    <div class="sidebar" class:drag-hidden={draggingAnything} style="z-index: {GRIM_Z.ui};">
        <div class="sidebar-top-row">
        <!-- Collapse / expand the sidebar -->
        <button class="sidebar-btn" class:active={sidebarOpen} onclick={() => {
            sidebarOpen = !sidebarOpen;
            // The draw tools live in the sidebar, so closing it leaves draw mode.
            if (!sidebarOpen) editing = false;
        }} title="{sidebarOpen ? 'Hide' : 'Show'} menu">
            {#if sidebarOpen}
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={keyboardArrowUpIcon}/></svg>
            {:else}
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={menuIcon}/></svg>
            {/if}
        </button>
        {@render sidebarTop?.()}
        </div>

        {#if sidebarOpen}
        {@render sidebarMenuStart?.()}

        <!-- Canvas control -->
        <div style="position: relative">
            <button class="sidebar-btn" class:active={editing} onclick={() => {
                editing = !editing;
                if (editing) showFooter = false;
            }} title="{editing ? 'Exit annotate mode' : 'Enter annotate mode'}">
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={editIcon}/></svg>
            </button>
            {#if editing}
            <!-- Raised one square (button + gap) to sit beside the button above rather than below it. -->
            <div style="position: absolute; left: 52px; top: -52px; display: flex; flex-direction: column; gap: 8px;">
                <!-- TOOLS -->
                {#each tools as tool, index}
                    <button class="sidebar-btn" class:active={index === activeToolIndex} onclick={() => activeToolIndex = index} title={tool.type === 'pen' ? `Pen tool (color: ${tool.color})` : 'Eraser tool'}>
                        {#if tool.type === 'pen'}
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" fill={tool.color} stroke="currentColor" stroke-width="2"/>
                            </svg>
                        {:else if tool.type === 'eraser'}
                            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={inkEraserIcon}/></svg>
                        {/if}
                    </button>
                {/each}
                <div style="height: 2px; background-color: #FFF9;"></div>
                {#each canvasLayers as layer, index}
                <div style="position: relative;">
                    <button class="sidebar-btn" class:active={activeCanvasLayerIndex === index} onclick={() => activeCanvasLayerIndex = index} title={`Activate layer ${index + 1}`}>
                        <div>{index + 1}</div>
                    </button>
                    {#if activeCanvasLayerIndex === index}
                    <div style="display: flex; gap: 4px; position: absolute; left: 52px; top: 0;">
                        <!-- Reset button -->
                        <button class="sidebar-btn" onclick={() => clearLayer(index)} title="Clear layer">
                            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={layersClearIcon}/></svg>
                        </button>
                        {#if canvasLayers.length > 1}
                        <!-- Delete Button -->
                        <button class="sidebar-btn" onclick={() => deleteLayer(index)} title="Delete layer">
                            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={deleteIcon}/></svg>
                        </button>
                        {/if}
                    </div>
                    {/if}
                </div>
                {/each}
                <!-- Add layer button -->
                <button class="sidebar-btn" onclick={addLayer} title="Add new layer">
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={addIcon}/></svg>
                </button>
            </div>
            {/if}
        </div>

        <!-- Lock/Unlock token positions -->
        <button class="sidebar-btn" class:active={tokensLocked} onclick={() => setTokensLocked(!tokensLocked)} title="{tokensLocked ? 'Unlock' : 'Lock'} token positions">
            {#if tokensLocked}
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={lockIcon}/></svg>
            {:else}
                <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={lockOpenIcon}/></svg>
            {/if}
        </button>

        {#if !tokensLocked}
        <!-- Auto-arrange: space the players evenly round a ring -->
        <button class="sidebar-btn" onclick={autoArrangeTokens} title="Auto-arrange tokens">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={cycleIcon}/></svg>
        </button>
        {/if}

        {@render sidebarMenuEnd?.()}
        {/if}
    </div>

    <AnotatableViewV2 ongesturestart={cancelPendingBoardTap} onresetview={fitView} bind:viewScale bind:viewTx bind:viewTy idleGestures={!dragging && !draggingReminder} idleIgnore=".sidebar button, .undo-stroke-btn, .grimoire-footer, .reminder-popup, .wake-toggle, [role='dialog']{ignoreGesturesOn ? `, ${ignoreGesturesOn}` : ''}" idlePanIgnore=".board-token, .board-reminder, button, a, input, [role='dialog']" tool={editing ? activeTool : null} penTool={lastPenTool} eraserTool={penEraserTool} penButtonErases onchange={onCanvasChange} oncommit={onCanvasCommit} onundo={undo && undoLastChange} layers={canvasLayers} activeLayerIndex={activeCanvasLayerIndex} canvasStyle="z-index: {GRIM_Z.canvas};">

    <div class="grimoire-board" bind:this={boardEl}>
        {#each ALIGNMENT_RING_FACTORS as factor}
            <div class="alignment-ring" style="width: {tokenSize * factor * 2}px; height: {tokenSize * factor * 2}px; z-index: {GRIM_Z.canvas - 1};"></div>
            <div class="alignment-ring square" style="width: {tokenSize * factor * 2}px; height: {tokenSize * factor * 2}px; z-index: {GRIM_Z.canvas - 1};"></div>
        {/each}

        <GrimPieces {model} ontokenpointerdown={startDragFromBoard} onreminderpointerdown={startDragReminderFromBoard}/>

        {#if night}
        {#each placedTokens as token (token.id)}
            <!-- Only on a player who still wakes: not on a dead (or ability-less) one sharing a character with one who
                 does. A Minion or Demon also has their Minion Info or Demon Info wake, the numbers one under the other -->
            {@const wakeNumbers = wakeNumbersOf(token)}
            {@const wakeToggleShown = token.id === activeTokenId && activeReminderPos && !isSideRoleCategory(characterById.get(token.characterId ?? '')?.category)}
            <!-- The badges, one under the other, centred on the token's side -->
            {@const badgeCount = wakeNumbers.length + (wakeToggleShown || token.customWake ? 1 : 0)}
            {@const badgeTop = (i: number) => token.y + (i - (badgeCount - 1) / 2) * tokenSize * 0.28}
            {#each wakeNumbers as wake, i}
            {@render wakeNumberBadge(wake, `left: calc(50% + ${token.x + tokenSize * 0.45}px); top: calc(50% + ${badgeTop(i)}px); font-size: ${tokenSize / 6}px; border-width: ${tokenSize / 70}px; z-index: ${GRIM_Z.nightOrder};`)}
            {/each}
            <!-- A custom wake: below the night order numbers, if they have any too. While the token's popup is open, it's
                 shown dotted when off, and tapping it turns the wake on or off -->
            {@const wakeStyle = `left: calc(50% + ${token.x + tokenSize * 0.45}px); top: calc(50% + ${badgeTop(wakeNumbers.length)}px); font-size: ${tokenSize / 6}px; border-width: ${tokenSize / 70}px; z-index: ${GRIM_Z.nightOrder};`}
            {#if wakeToggleShown}
            {@render wakeToggle(token.customWake ?? false, wakeStyle, toggleCustomWake)}
            {:else if token.customWake}
            <div class="night-order-badge" style={wakeStyle}>?</div>
            {/if}
        {/each}
        {/if}
    </div>

    {@render centre?.()}

    </AnotatableViewV2>

    {#if activeTokenId !== null && activeReminderPos && (activeCharacterId === null || reminderCache[activeCharacterId])}
        <div bind:this={reminderPopupEl} class="reminder-popup" class:above={activeReminderAbove} style="font-size: {tokenSize * 0.12}px; left: {activeReminderPos.x}px; top: {activeReminderPos.y}px; z-index: {GRIM_Z.ui};">
            {#if activeToken}
                {@const activeChar = characterById.get(activeCharacterId ?? '')}
                {@const sideRole = isSideRoleCategory(activeChar?.category)}
                {#if playerCommsShown && activeChar && !sideRole && comms}
                <!-- The character's presets for tonight and Back, in place of everything else -->
                <div class="popup-comms">
                    {#each comms.presetsFor(activeChar.id) as preset}
                        <button type="button" class="popup-toggle" onclick={() => comms.showPreset(preset, activeChar.id)}>{presetDisplayName(preset)}</button>
                    {/each}
                    <button type="button" class="button-style comms-plain" onclick={() => playerCommsShown = false}><MaterialIcon icon={chevronLeftIcon} size="1.2em"/> Back</button>
                </div>
                {:else}
                <div class="popup-meta" bind:clientHeight={popupMetaHeight}>
                    {#if !sideRole}
                        {#if editingPlayerName}
                        <input
                            bind:this={playerNameInput}
                            type="text"
                            class="popup-player-name"
                            placeholder="Player name"
                            value={activeToken.playerName ?? ''}
                            oninput={(e) => setPlayerName((e.target as HTMLInputElement).value)}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                            onblur={() => editingPlayerName = false}
                            onpointerdown={(e) => e.stopPropagation()}
                        />
                        {:else}
                        <div class="popup-name-row">
                            <span class="popup-name-text" class:unnamed={!activeToken.playerName?.trim()}>{activeToken.playerName?.trim() || 'No player name'}</span>
                            <button type="button" class="popup-toggle popup-name-edit" onclick={startEditingPlayerName} title="Edit player name" aria-label="Edit player name">
                                <PencilIcon size={18}/>
                            </button>
                        </div>
                        {/if}
                    {/if}
                    <div class="popup-buttons">
                        {#if sideRole}
                            {#if activeChar && onshowcharacter}
                                <button type="button" class="popup-toggle with-icon" onclick={() => onshowcharacter(activeChar.id)}>{@render eyeIcon()}Show</button>
                            {/if}
                            <button type="button" class="popup-toggle" onclick={() => pickingCharacter = true}>Change character</button>
                        {:else}
                            <button type="button" class="popup-toggle" class:dead={activeToken.isDead} onclick={toggleAlive}>
                                {activeToken.isDead ? 'Dead' : 'Alive'}
                            </button>
                            <!-- Only dead players have a ghost vote -->
                            <button type="button" class="popup-toggle" class:has-vote={hasDeadVote(activeToken)} disabled={!activeToken.isDead} onclick={toggleDeadVote}>
                                {activeToken.isDead && activeToken.deadVoteUsed ? 'Vote used' : 'Has vote'}
                            </button>
                            <button type="button" class="popup-toggle" class:evil={activeToken.alignment === 'evil'} onclick={toggleAlignment}>
                                {activeToken.alignment === 'evil' ? 'Evil' : 'Good'}
                            </button>
                            <button type="button" class="popup-toggle" onclick={() => pickingCharacter = true}>
                                {activeChar ? 'Change character' : 'Choose character'}
                            </button>
                            {#if onshowcharacter}
                                <button type="button" class="popup-toggle with-icon" disabled={!activeChar} onclick={() => activeChar && onshowcharacter(activeChar.id)}>{@render eyeIcon()}Show</button>
                            {/if}
                            {#if comms}
                                <!-- The character's own presets for tonight -->
                                <button type="button" class="popup-toggle with-icon" disabled={!activeChar}
                                    onclick={() => activeChar && openPlayerComms(activeChar.id)}>{@render commsIcon()}Comms</button>
                            {/if}
                        {/if}
                    </div>
                    {#if activeChar?.rules}
                        <div class="popup-rules">
                            <div class="popup-rules-name">{activeChar.name}</div>
                            <div class="popup-rules-text">{activeChar.rules}</div>
                            {#if activeChar.setup}
                                <div class="popup-rules-text setup-text">[{activeChar.setup}]</div>
                            {/if}
                        </div>
                    {/if}
                </div>
                <div class="popup-divider"></div>
                {/if}
            {/if}
            {#if activeCharacterId !== null && !playerCommsShown}
                {#if (reminderCache[activeCharacterId] ?? []).length === 0}
                    <span style="color: #999; font-size: 0.8em; padding: 4px;">No reminders</span>
                {:else}
                    <!-- Down in columns, starting a new column once one is as tall as the controls beside it -->
                    <div class="reminder-popup-tokens" style="grid-template-rows: repeat({popupReminderRows}, auto); gap: {POPUP_REMINDER_GAP}px;">
                        {#each reminderCache[activeCharacterId] ?? [] as rToken (rToken.id)}
                            <div class="reminder-popup-token" role="presentation" onpointerdown={(e) => startDragReminderFromPopup(e, rToken)}>
                                <ReminderTokenView data={rToken} characterId={activeCharacterId} size="{popupReminderSize}px"/>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}

    {#if !showFooter}
        <button class="open-tray-btn open-tray-tab" class:drag-hidden={draggingAnything} onclick={toggleTray} title="Show token tray" style="z-index: {GRIM_Z.ui};">
            <!-- An up arrow, centred over the whole button, above a tray holding three tokens and the button's name -->
            <svg class="open-tray-arrow" viewBox="8 2 8 4.5" aria-hidden="true"><path d="M8.5 6L12 2.5L15.5 6z"/></svg>
            <span class="open-tray-label">
                <svg viewBox="1.5 11 21 10" aria-hidden="true">
                    <circle cx="7" cy="14.5" r="2.4"/>
                    <circle cx="12" cy="14.5" r="2.4"/>
                    <circle cx="17" cy="14.5" r="2.4"/>
                    <path d="M2.5 12v6.5a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Token Tray
            </span>
        </button>
    {/if}

    <!-- FOOTER -->
    <div class="grimoire-footer" bind:this={footerEl} style="--tray-token: {trayTokenSize}px; transform: translateY({showFooter && !dragging && !draggingReminder ? '0' : '100%'}); z-index: {GRIM_Z.ui};">
        <div class="token-tray-container">
            <div class="token-tray-header">
                <button class="overlay-close tray-close-btn" onclick={() => showFooter = false} aria-label="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                <div class="tray-title">Token Tray</div>
            </div>
            <div class="token-tray">
                {#if model.traySections.length === 0}
                    <div style="text-align: center; opacity: 0.6; padding: 1em;">Loading…</div>
                {:else}
                {#each model.traySections as section (section.key)}
                {#if section.key === 'script' && trayBluffs}
                    <div>
                        <div class="tray-section-toggle fixed">Bluffs <span class="tray-section-count">{trayBluffs.count}</span></div>
                        {@render trayBluffs.content()}
                    </div>
                {/if}
                {@const collapsed = section.collapsible && !expandedTraySections.includes(section.key)}
                <div>
                    {#if section.collapsible}
                        <button class="tray-section-toggle" aria-expanded={!collapsed} onclick={() => toggleTraySection(section.key)}>
                            <svg viewBox={ICON_VIEWBOX} class:collapsed fill="currentColor"><path d={keyboardArrowDownIcon}/></svg>
                            {section.title}
                            <span class="tray-section-count">{section.characters.length}</span>
                        </button>
                    {:else}
                        <div class="tray-section-toggle fixed">{section.title} <span class="tray-section-count">{section.characters.length}</span></div>
                    {/if}
                    {#if !collapsed}
                    <div class="sub-tray">
                        {#each section.characters as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character?.id === character.id}
                                    class:off-grim={!model.isInPlay(character.id)}
                                    role="button"
                                    tabindex="0"
                                    aria-label={character.name}
                                    onpointerdown={(e) => startTrayHold(e, character)}
                                    oncontextmenu={(e) => e.preventDefault()}
                                    ondragstart={(e) => e.preventDefault()}
                                    onclick={() => onTrayTokenClick(character)}
                                    onkeydown={(e) => onActivateKey(e, () => openCharacterOverlay(character))}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} imageSize={TRAY_IMAGE_SIZE} norules/>
                                </div>
                        {/each}
                    </div>
                    {/if}
                </div>
                {/each}
                {/if}
            </div>
        </div>
    </div>

    {#if overlayOpen}
        {@const oc = overlayCharacter}
        {@const sideRole = isSideRoleCategory(oc?.category)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {GRIM_Z.ui + 10};" onclick={(e) => { if (!(e.target as Element).closest('input')) closeOverlay(); }}>
            <div class="overlay-panel">
                <button class="overlay-close" onclick={closeOverlay} aria-label="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                {#if overlayFromBoard && activeToken && oc && playerCommsShown && comms}
                    <!-- The character's presets for tonight and Back, in place of everything else -->
                    <div class="overlay-comms">
                        {#each comms.presetsFor(oc.id) as preset}
                            <button type="button" class="popup-toggle" onclick={(e) => { e.stopPropagation(); comms.showPreset(preset, oc.id); }}>{presetDisplayName(preset)}</button>
                        {/each}
                        <button type="button" class="button-style" onclick={(e) => { e.stopPropagation(); playerCommsShown = false; }}><MaterialIcon icon={chevronLeftIcon} size="1.2em"/> Back</button>
                    </div>
                {:else}
                    {#if overlayFromBoard && activeToken && !sideRole}
                        <input
                            type="text"
                            class="popup-player-name overlay-player-name"
                            placeholder="Player name"
                            value={activeToken.playerName ?? ''}
                            oninput={(e) => setPlayerName((e.target as HTMLInputElement).value)}
                        />
                    {/if}
                    {#if oc}
                        {#if overlayFromBoard}
                            <!-- A placed token's summary shows the token itself, its name on it and its type in its ring's colour, with
                                 its night order and custom wake badges where the board has them -->
                            {@const size = OVERLAY_SUMMARY_TOKEN_SIZE}
                            {@const wakeNumbers = activeToken && night ? wakeNumbersOf(activeToken) : []}
                            <!-- Its badges centred on the token's side, as on the board -->
                            {@const badgeCount = wakeNumbers.length + (activeToken && !sideRole && night ? 1 : 0)}
                            {@const badgeTop = (i: number) => size / 2 + (i - (badgeCount - 1) / 2) * size * 0.28}
                            <div style="position: relative; flex-shrink: 0; width: {size}px; height: {size}px;">
                                <CharacterToken character={oc} style="position: relative;" size="{size}px" norules/>
                                {#each wakeNumbers as wake, i}
                                    {@render wakeNumberBadge(wake, `left: ${size * 0.95}px; top: ${badgeTop(i)}px; font-size: ${size / 6}px; border-width: ${size / 70}px;`)}
                                {/each}
                                {#if activeToken && !sideRole && night}
                                    {@render wakeToggle(activeToken.customWake ?? false, `left: ${size * 0.95}px; top: ${badgeTop(wakeNumbers.length)}px; font-size: ${size / 6}px; border-width: ${size / 70}px;`, (e) => { e.stopPropagation(); toggleCustomWake(); })}
                                {/if}
                            </div>
                        {:else}
                            <img class="overlay-icon" src={`/api/characters/${oc.id}/img`} alt="" onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
                            <div class="overlay-name dumbledore-font">{oc.name}</div>
                            <div class="overlay-category">{oc.category}</div>
                        {/if}
                        {#if oc.rules}
                            <div class="overlay-rules">{oc.rules}</div>
                        {/if}
                        {#if oc.setup}
                            <div class="overlay-rules setup-text">[{oc.setup}]</div>
                        {/if}
                    {:else if activeToken}
                        <div class="overlay-name dumbledore-font">{activeToken.playerName || 'Player'}</div>
                        <div class="overlay-category">No character</div>
                    {/if}
                    {#if overlayFromBoard && activeToken}
                        <div class="overlay-toggles">
                            {#if !sideRole}
                            <button type="button" class="popup-toggle" class:dead={activeToken.isDead} onclick={(e) => { e.stopPropagation(); toggleAlive(); }}>
                                {activeToken.isDead ? 'Dead' : 'Alive'}
                            </button>
                            <button type="button" class="popup-toggle" class:evil={activeToken.alignment === 'evil'} onclick={(e) => { e.stopPropagation(); toggleAlignment(); }}>
                                {activeToken.alignment === 'evil' ? 'Evil' : 'Good'}
                            </button>
                            {#if activeToken.isDead}
                                <button type="button" class="popup-toggle" class:has-vote={hasDeadVote(activeToken)} onclick={(e) => { e.stopPropagation(); toggleDeadVote(); }}>
                                    {activeToken.deadVoteUsed ? 'Vote used' : 'Has vote'}
                                </button>
                            {/if}
                            {/if}
                            {#if oc}
                                {#if onshowcharacter}
                                    <button type="button" class="button-style with-icon" onclick={() => onshowcharacter(oc.id)}>{@render eyeIcon()}Show</button>
                                {/if}
                                {#if !sideRole && comms}
                                    <button type="button" class="button-style with-icon" onclick={(e) => { e.stopPropagation(); openPlayerComms(oc.id); }}>{@render commsIcon()}Comms</button>
                                {/if}
                            {/if}
                        </div>
                        <button type="button" class="button-style" onclick={(e) => { e.stopPropagation(); pickingCharacter = true; }}>
                            {oc ? 'Change character' : 'Choose character'}
                        </button>
                    {/if}
                    {#if oc}
                        {#if !overlayFromBoard && onshowcharacter}
                            <button class="button-style with-icon" onclick={() => onshowcharacter(oc.id)}>{@render eyeIcon()}Show</button>
                        {/if}
                        <div class="overlay-drag-hint">{overlayFromBoard ? 'Drag a reminder onto the grim' : 'Drag onto the grim'}</div>
                        <div class="overlay-tokens">
                            {#if !overlayFromBoard}
                                <div class="overlay-drag-token" role="presentation" onpointerdown={(e) => startDragCharacterFromOverlay(e, oc)}>
                                    <CharacterToken character={oc} style="position: relative;" size="{OVERLAY_TOKEN_SIZE}px" norules/>
                                </div>
                            {/if}
                            {#each reminderCache[oc.id] ?? [] as rToken (rToken.id)}
                                <div class="overlay-drag-token" role="presentation" onpointerdown={(e) => startDragReminderFromOverlay(e, rToken, oc.id)}>
                                    <ReminderTokenView data={rToken} characterId={oc.id} size="{OVERLAY_TOKEN_SIZE * 0.7}px"/>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    {/if}

    {#if pickingCharacter && activeToken}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {GRIM_Z.ui + 20};" onclick={() => pickingCharacter = false}>
            <div class="overlay-panel" style="width: min(94vw, 720px);">
                <button class="overlay-close" onclick={() => pickingCharacter = false} aria-label="Close"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                <div class="overlay-name dumbledore-font">{activeToken.playerName || 'Player'}</div>
                <div class="overlay-drag-hint">Choose a character</div>
                <div class="picker-grid">
                    {#each pickableCharacters as character (character.id)}
                        <button class="no-button-style tray-token" class:off-grim={!model.isInPlay(character.id)} onclick={(e) => { e.stopPropagation(); setCharacter(character.id); }}>
                            <CharacterToken {character} style="position: relative;" size="{trayTokenSize}px" imageSize={TRAY_IMAGE_SIZE} norules/>
                        </button>
                    {/each}
                </div>
                {#if activeToken.characterId !== null}
                    <button class="button-style" onclick={(e) => { e.stopPropagation(); setCharacter(null); }}>No character</button>
                {/if}
            </div>
        </div>
    {/if}

    {#if dragging && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px; z-index: {GRIM_Z.ui};">
            {#if dragging.character}
                <CharacterToken character={dragging.character} style="position: relative;" size={tokenSize * viewScale + 'px'} norules/>
            {:else}
                <PlayerToken playerName={dragging.sourceToken?.playerName ?? ''} style="position: relative;" size={tokenSize * viewScale + 'px'}/>
            {/if}
        </div>
        {@render deleteZones()}
    {/if}

    {#if draggingReminder && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px;">
            <ReminderTokenView data={draggingReminder.token} characterId={draggingReminder.characterId} size="{reminderTokenSize * viewScale}px"/>
        </div>
        {@render deleteZones()}
    {/if}

    {#snippet deleteZones()}
        {#each ['top', 'bottom'] as edge}
            <div class="delete-zone {edge}" class:active={ghostPos !== null && deleteEdgeFor(ghostPos) === edge} style="height: {EDGE_THRESHOLD}px; z-index: {GRIM_Z.ui};">
                <svg viewBox={ICON_VIEWBOX} width="28" height="28" fill="currentColor"><path d={deleteIcon}/></svg>
            </div>
        {/each}
    {/snippet}
</div>

<style>
    /* Fills whatever it's in, and clips everything that's part of it (e.g. the hidden tray sitting below it, popups)
       so nothing can extend the page's scrollable area. */
    .grim-board-root {
        position: absolute;
        inset: 0;
        overflow: hidden;
        overscroll-behavior: none;
        /* All touch gestures (pinch/pan/drag) are handled in JS; stop the browser zooming or scrolling the page. */
        touch-action: none;
    }

    .grimoire-board {
        position: absolute;
        inset: 0;
    }

    .alignment-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.01);
        box-sizing: border-box;
        pointer-events: none;
    }

    .alignment-ring.square {
        border-radius: 0;
    }

    /* The tray takes over the whole of the board and scrolls vertically, slightly see-through so the grim shows
       faintly behind it. */
    .grimoire-footer {
        transition: transform 0.3s ease;
        position: absolute;
        inset: 0;
        background-color: color-mix(in srgb, var(--grim-panel-bg) 93%, transparent);
    }

    .token-tray-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow-y: hidden;
        padding: 0.5em 0.5em 0;
        box-sizing: border-box;
    }

    /* Out to the tray's edges, past the container's padding */
    .token-tray-header {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5em;
        min-height: 40px;
        margin: -0.5em -0.5em 0.5em;
    }

    /* Centred at the title bar's right end */
    .token-tray-header .tray-close-btn {
        top: 50%;
        right: 4px;
        transform: translateY(-50%);
        z-index: 1;
    }

    /* A bar right across the tray, tinted as the sections' headers are */
    .tray-title {
        flex: 1;
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        /* Clear of the close button at its right end */
        padding: 0 44px;
        /* The sections' header tint, but solid: the see-through tray doesn't show through it */
        background: color-mix(in srgb, var(--grim-panel-bg) 92%, white);
        font-size: 1.15em;
        font-weight: 600;
    }

    .token-tray {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
        touch-action: pan-y;
        -webkit-overflow-scrolling: touch;
        padding: 0 0 3em;
    }

    /* The sections, no wider than this on a big screen, centred */
    .token-tray > * {
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
    }

    .sub-tray {
        display: grid;
        /* Fixed-width columns (not 1fr) so spare row width doesn't stretch the gaps between tokens. */
        grid-template-columns: repeat(auto-fill, calc(var(--tray-token) + 2px));
        justify-content: center;
        justify-items: center;
        align-items: center;
        gap: 0.15em;
        padding: 0.5em;
        box-sizing: border-box;
    }

    .tray-section-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.3em;
        width: 100%;
        padding: 0.5em 0.7em;
        border: none;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        white-space: nowrap;
        cursor: pointer;
        touch-action: manipulation;
    }

    /* The same header on the sections that are always open, which can't be folded away. */
    .tray-section-toggle.fixed {
        cursor: default;
    }

    .tray-section-toggle svg {
        width: 1.2em;
        height: 1.2em;
        fill: currentColor;
        transition: transform 0.15s;
    }

    .tray-section-toggle svg.collapsed {
        transform: rotate(-90deg);
    }

    .tray-section-count {
        opacity: 0.6;
        font-size: 0.85em;
    }

    .overlay-icon {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    /* Wraps onto a second line when they don't all fit (e.g. a dead player's ghost vote as well) */
    .overlay-toggles {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }

    /* Trim the horizontal padding so more of them fit on a line, and share out what's left of each line between them. */
    .overlay-panel .overlay-toggles > button {
        flex: 1 1 auto;
        padding: 16px 16px;
        white-space: nowrap;
    }

    /* A character's presets in the player info, in place of its buttons, with the Back button under them */
    .overlay-comms {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        /* Clear of the close button in the panel's corner */
        margin-top: 24px;
    }

    .overlay-panel .popup-player-name {
        font-size: 1em;
        padding: 8px 10px;
    }

    /* Sits above the icon, clear of the close button in the corner. */
    .overlay-panel .overlay-player-name {
        width: calc(100% - 80px);
        text-align: center;
    }

    .overlay-rules {
        opacity: 0.9;
        line-height: 1.35;
    }

    .overlay-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 0.8em;
    }

    .overlay-drag-token {
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .drag-ghost {
        position: fixed;
        pointer-events: none;
        transform: translate(-50%, -50%);
        opacity: 0.8;
    }

    .reminder-popup {
        position: absolute;
        transform: translate(-50%, 0);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.85);
        border-radius: 10px;
        white-space: nowrap;
    }
    .reminder-popup.above {
        transform: translate(-50%, -100%);
    }

    .popup-meta {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    /* As wide as the name box and buttons above it, never wider: the width of 0 keeps the text from widening the
       popup, and the min-width then fills it out to the column's full width. */
    .popup-rules {
        width: 0;
        min-width: 100%;
        white-space: normal;
        color: #e5e7eb;
        font-size: 0.75em;
        line-height: 1.3;
    }
    .popup-rules-name {
        font-weight: 600;
        margin-bottom: 2px;
        color: #f3f4f6;
    }
    .popup-rules-text {
        opacity: 0.85;
    }
    .setup-text {
        font-weight: 600;
    }
    /* In pairs: the player's life and vote, their alignment and character, then what to show them. Every button the
       same size: a long label wraps rather than widening its column */
    .popup-buttons {
        display: grid;
        grid-template-columns: repeat(2, 6.2em);
        grid-auto-rows: 1fr;
        gap: 6px;
    }
    /* Two lines tall, so "Change character" fits on two */
    .popup-buttons .popup-toggle {
        white-space: normal;
        line-height: 1.2;
        min-height: max(40px, calc(2.4em + 1.2em));
    }
    /* A character's presets and Back, filling the popup in place of its controls and reminders */
    .popup-comms {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: calc(2 * 6.2em + 6px);
    }
    .popup-comms .popup-toggle {
        white-space: normal;
        line-height: 1.2;
    }
    /* Back among the popup's presets: a plain button, as big as the presets */
    .popup-comms .button-style {
        min-height: 40px;
        font-size: 0.8em;
        font-weight: 600;
        padding: 0.6em 1em;
    }
    .popup-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 40px;
    }
    .popup-name-text {
        flex: 1;
        color: #f3f4f6;
        font-size: 0.95em;
        font-weight: 600;
        padding: 0 0.2em;
    }
    .popup-name-text.unnamed {
        color: #9ca3af;
        font-weight: 400;
        font-style: italic;
    }
    .popup-name-edit {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        width: 40px;
        flex-shrink: 0;
    }
    .popup-player-name {
        background: #1f2937;
        color: #e5e7eb;
        border: 1px solid #4b5563;
        border-radius: 6px;
        padding: 0.5em 0.7em;
        min-height: 40px;
        font-size: 0.85em;
        width: 100%;
        box-sizing: border-box;
    }
    .popup-divider {
        width: 1px;
        align-self: stretch;
        background: rgba(255, 255, 255, 0.18);
        margin: 2px 2px;
    }

    /* A grid rather than a wrapping flex column, which browsers don't widen properly for the extra columns */
    .reminder-popup-tokens {
        display: grid;
        grid-auto-flow: column;
        align-self: center;
        align-items: center;
    }

    .reminder-popup-token {
        cursor: grab;
        touch-action: none;
        user-select: none;
        flex-shrink: 0;
    }

    .reminder-popup-token:active {
        cursor: grabbing;
    }

    .night-order-badge {
        position: absolute;
        transform: translate(-60%, -50%);
        border-style: solid;
        border-radius: 50%;
        background-color: rgb(150, 85, 5);
        border-color: white;
        box-shadow: 0 3px 4px #0008;
        color: white;
        text-shadow: 0 0 5px #0004;
        height: 1.5em;
        width: 1.5em;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        user-select: none;
    }
    /* The Minion Info and Demon Info wakes, told apart from the characters' own in evil's red */
    .night-order-badge.info-wake {
        background-color: rgb(110, 25, 32);
    }
    /* An open token's wake badge, tapped to turn the wake on or off: a dotted outline while it's off; and a night order
       number, tapped to show what wakes then */
    .wake-toggle, .wake-number {
        box-sizing: content-box;
        padding: 0;
        margin: 0;
        font: inherit;
        line-height: 1;
        cursor: pointer;
        pointer-events: auto;
        touch-action: manipulation;
    }
    .wake-toggle.off {
        border-style: dotted;
        background-color: #0006;
        box-shadow: none;
        color: #fff9;
    }

    .delete-zone {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        box-sizing: border-box;
        border-radius: 12px;
        background: rgba(255, 60, 60, 0.12);
        border: 2px dashed rgba(255, 60, 60, 0.7);
        color: rgba(255, 255, 255, 0.85);
        transition: background 0.15s;
    }

    /* Kept a few px off the very top so the browser doesn't sample it for the status bar colour. */
    .delete-zone.top { top: 6px; }
    .delete-zone.bottom { bottom: 0; }

    .delete-zone.active {
        background: rgba(255, 60, 60, 0.35);
    }

    .sidebar {
        position: absolute;
        left: 0;
        top: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        /* The box spans the gaps between (and beside) the buttons; let touches there reach the board, so a pinch
           with a finger near the sidebar still works. Only the buttons and popups themselves catch the pointer. */
        pointer-events: none;
    }

    .sidebar :global(button),
    .sidebar :global([role='dialog']) {
        pointer-events: auto;
    }

    .sidebar-top-row {
        display: flex;
        gap: 8px;
    }

    /* In the top right: just left of the page's save status, if it has one (--grim-undo-right, and --grim-undo-top
       to line it up with what's beside it) */
    .undo-stroke-btn {
        position: absolute;
        top: var(--grim-undo-top, 4px);
        right: var(--grim-undo-right, 52px);
    }

    .open-tray-tab {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        padding: 5px 14px 7px;
        border: none;
        border-radius: 8px 8px 0 0;
        background: var(--grim-panel-bg);
        color: white;
        font: inherit;
        font-size: 14px;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        cursor: pointer;
        touch-action: manipulation;
        opacity: 0.85;
    }

    .open-tray-tab:hover {
        opacity: 1;
    }

    .open-tray-tab svg {
        fill: currentColor;
    }

    .open-tray-arrow {
        width: 14px;
        height: 8px;
    }

    .open-tray-label {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .open-tray-label svg {
        width: 30px;
        height: 14px;
    }
</style>
