import { parseArgs } from "node:util";
import { DEFAULT_TAG_BASE, buildImage, docker, resolveTags } from "./docker-build.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        "tag-base": { type: "string", short: "t", default: DEFAULT_TAG_BASE },
        registry: { type: "string", short: "r" },
        "archive-out": { type: "string", short: "o" },
        help: { type: "boolean", short: "h" }
    }
});

if (values.help) {
    console.log(`Build and push Docker image for BOTC Clocktower

Usage: npm run docker:push -- [package_dir] [options]

  package_dir            Directory containing package.json (default: .)
  -t, --tag-base <name>  Base name for the image tag (default: ${DEFAULT_TAG_BASE})
  -r, --registry <url>   Docker registry URL
  -o, --archive-out <f>  Also save the built image as a tar archive (e.g. botc-clockmaker.tar)`);
    process.exit(0);
}

const packageDir = positionals[0] ?? ".";
const { latestImageTag, imageTag } = resolveTags({ packageDir, tagBase: values["tag-base"], registry: values.registry });

console.log("Building and pushing Docker image:", imageTag);

buildImage({ packageDir, latestImageTag, imageTag, platform: "linux/amd64" });

console.log("\n\n\n\n\nPushing Docker image...");
docker("push", latestImageTag);
docker("push", imageTag);

if (values["archive-out"]) {
    console.log("\n\n\n\n\nSaving Docker image to archive:", values["archive-out"]);
    docker("save", imageTag, "-o", values["archive-out"]);
}

console.log("\n\nDone.\n\n");
