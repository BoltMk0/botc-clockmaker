import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { findResourceById, getResourceFilePath } from "./resources";
import { getMusicLibrary, getMusicTrack, setMusicTrackLoudness } from "./musicLibrary";

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
/** What ffmpeg's EBU R128 meter reads for silence (it gates out everything below this). */
const SILENCE_LUFS = -70;

/** Emits 'changed' (trackId, loudness) each time a track's loudness is measured, or set by hand. */
export const musicLoudnessEvents = new EventEmitter();

const queue: string[] = [];
let running = false;
/** Set once ffmpeg turns out not to be there, so it isn't tried (and warned about) for every track. */
let unavailable = false;

class FfmpegUnavailableError extends Error { }

/**
 * Queues tracks to have their loudness measured, one at a time in the background. A track already queued isn't
 * queued again.
 */
export function queueMusicLoudness(...trackIds: string[]) {
    if (unavailable) return;
    for (const id of trackIds) if (!queue.includes(id)) queue.push(id);
    if (!running) void work();
}

/** Queues every track whose loudness hasn't been measured yet. Called once at startup. */
export function startMusicLoudnessWorker() {
    const unmeasured = getMusicLibrary().tracks.filter(t => t.loudness === undefined).map(t => t.id);
    if (unmeasured.length === 0) return;
    console.log(`Music loudness: measuring ${unmeasured.length} track(s) in the background`);
    queueMusicLoudness(...unmeasured);
}

async function work() {
    running = true;
    try {
        let id: string | undefined;
        while ((id = queue.shift()) !== undefined) {
            const track = getMusicTrack(id);
            const resource = track && findResourceById(track.file);
            if (!track || !resource) continue; // Deleted since it was queued
            let loudness: number | null;
            try {
                loudness = await measureLoudness(getResourceFilePath(resource));
            } catch (e) {
                if (e instanceof FfmpegUnavailableError) {
                    console.warn(`Music loudness: couldn't run ffmpeg ("${FFMPEG}"), so tracks won't be measured. Install it, or set FFMPEG_PATH`);
                    unavailable = true;
                    queue.length = 0;
                    return;
                }
                console.warn(`Music loudness: couldn't measure "${track.title}"`, e);
                loudness = null;
            }
            // Set by hand while it was being measured: that stands
            if (getMusicTrack(id)?.loudness !== undefined) continue;
            setMusicTrackLoudness(id, loudness);
            musicLoudnessEvents.emit('changed', id, loudness);
        }
    } finally {
        running = false;
    }
}

/** The file's integrated loudness (EBU R128) in LUFS, or null if it's silent. Rejects if ffmpeg can't read it. */
function measureLoudness(filepath: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
        // framelog=verbose keeps the meter's per-frame readings out of the log, leaving just the summary
        const ffmpeg = spawn(FFMPEG, ['-hide_banner', '-nostats', '-nostdin', '-threads', '1', '-i', filepath,
            '-map', '0:a:0', '-vn', '-af', 'ebur128=framelog=verbose', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
        let log = '';
        ffmpeg.stderr.setEncoding('utf-8');
        ffmpeg.stderr.on('data', (chunk: string) => { log = (log + chunk).slice(-8192); });
        ffmpeg.on('error', (e: NodeJS.ErrnoException) => reject(e.code === 'ENOENT' ? new FfmpegUnavailableError(e.message) : e));
        ffmpeg.on('close', (code) => {
            if (code !== 0) return reject(new Error(`ffmpeg exited with ${code}: ${log.trim().split('\n').slice(-3).join(' / ')}`));
            const match = /Integrated loudness:\s*I:\s*(-?[\d.]+|-?inf)\s*LUFS/i.exec(log);
            if (!match) return reject(new Error("ffmpeg didn't report a loudness"));
            const lufs = parseFloat(match[1]);
            resolve(isFinite(lufs) && lufs > SILENCE_LUFS ? Math.round(lufs * 10) / 10 : null);
        });
    });
}
