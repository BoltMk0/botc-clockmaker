import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

export const DEFAULT_IMAGE_NAME = "boltmk0/botc-clockmaker";

// The image's full tags: just `:<tag>` if one is given, otherwise `:<package.json version>` and `:latest`.
export function resolveTags({ packageDir = ".", name = DEFAULT_IMAGE_NAME, tag, registry } = {}) {
    const prefix = registry ? `${registry}/${name}` : name;
    if (tag) return [`${prefix}:${tag}`];
    const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf-8"));
    return [`${prefix}:${version}`, `${prefix}:latest`];
}

// Runs a docker command with inherited stdio, exiting the process if it fails.
export function docker(...args) {
    const result = spawnSync("docker", args, { stdio: "inherit" });
    if (result.error || result.status !== 0) {
        console.error(`\ndocker ${args[0]} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`);
        process.exit(result.status ?? 1);
    }
}

// Builds the image with each of `tags`. `platform` is optional (defaults to the host's).
export function buildImage({ packageDir = ".", tags, platform }) {
    console.log("Building Docker image:", tags.join(", "));
    docker("build", ...tags.flatMap(tag => ["-t", tag]), ...(platform ? ["--platform", platform] : []), packageDir);
}

// Only runs when invoked directly (e.g. `npm run docker:build`), not when imported by another script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            name: { type: "string", short: "n", default: DEFAULT_IMAGE_NAME },
            tag: { type: "string", short: "t" },
            registry: { type: "string", short: "r" },
            platform: { type: "string", short: "p" },
            help: { type: "boolean", short: "h" }
        }
    });

    if (values.help) {
        console.log(`Build the Docker image for BOTC Clocktower locally

Usage: npm run docker:build -- [package_dir] [options]

  package_dir            Directory containing package.json (default: .)
  -n, --name <name>      Image name (default: ${DEFAULT_IMAGE_NAME})
  -t, --tag <tag>        Tag the image only with this (default: the package.json version and latest)
  -r, --registry <url>   Docker registry URL to prefix the name with
  -p, --platform <p>     Target platform, e.g. linux/amd64 (default: the host's)`);
        process.exit(0);
    }

    const packageDir = positionals[0] ?? ".";
    buildImage({
        packageDir,
        platform: values.platform,
        tags: resolveTags({ packageDir, name: values.name, tag: values.tag, registry: values.registry })
    });
    console.log("\n\nDone.\n\n");
}
