import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

export const DEFAULT_TAG_BASE = "boltmk0/botc-clockmaker";

// The `:latest` and `:<package.json version>` tags for the image.
export function resolveTags({ packageDir = ".", tagBase = DEFAULT_TAG_BASE, registry } = {}) {
    const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf-8"));
    const prefix = registry ? `${registry}/` : "";
    return {
        latestImageTag: `${prefix}${tagBase}:latest`,
        imageTag: `${prefix}${tagBase}:${version}`
    };
}

// Runs a docker command with inherited stdio, exiting the process if it fails.
export function docker(...args) {
    const result = spawnSync("docker", args, { stdio: "inherit" });
    if (result.error || result.status !== 0) {
        console.error(`\ndocker ${args[0]} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`);
        process.exit(result.status ?? 1);
    }
}

// Builds the image, tagged with both the latest and version tags. `platform` is optional (defaults to the host's).
export function buildImage({ packageDir = ".", latestImageTag, imageTag, platform }) {
    console.log("Building Docker image:", imageTag);
    docker("build", "-t", latestImageTag, "-t", imageTag, ...(platform ? ["--platform", platform] : []), packageDir);
}

// Only runs when invoked directly (e.g. `npm run docker:build`), not when imported by another script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            "tag-base": { type: "string", short: "t", default: DEFAULT_TAG_BASE },
            registry: { type: "string", short: "r" },
            platform: { type: "string", short: "p" },
            help: { type: "boolean", short: "h" }
        }
    });

    if (values.help) {
        console.log(`Build the Docker image for BOTC Clocktower locally

Usage: npm run docker:build -- [package_dir] [options]

  package_dir            Directory containing package.json (default: .)
  -t, --tag-base <name>  Base name for the image tag (default: ${DEFAULT_TAG_BASE})
  -r, --registry <url>   Docker registry URL to prefix the tag with
  -p, --platform <p>     Target platform, e.g. linux/amd64 (default: the host's)`);
        process.exit(0);
    }

    const packageDir = positionals[0] ?? ".";
    buildImage({
        packageDir,
        platform: values.platform,
        ...resolveTags({ packageDir, tagBase: values["tag-base"], registry: values.registry })
    });
    console.log("\n\nDone.\n\n");
}
