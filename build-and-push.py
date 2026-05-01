import json
import subprocess
import os
import argparse


ap = argparse.ArgumentParser(description="Build and push Docker image for BOTC Clocktower")
ap.add_argument("package_dir", default=".", nargs="?", help="Directory containing package.json (default: current directory)")
ap.add_argument("--tag-base", "-t", default="boltmk0/botc-clocktower", help="Base name for Docker image tag (default: boltmk0/botc-clocktower)")
ap.add_argument("--registry", help="Docker registry URL")
ap.add_argument("--archive-out", "-o", help="Optional path to save the built Docker image as a tar archive (e.g. botc-clocktower.tar)")

args = ap.parse_args()

package_json_path = os.path.join(args.package_dir, "package.json")
package_json_data = json.load(open(package_json_path))
version = package_json_data["version"]

latest_image_tag = f"{args.tag_base}:latest"
image_tag = f"{args.tag_base}:{version}"

if(args.registry):
    latest_image_tag = f"{args.registry}/{latest_image_tag}"
    image_tag = f"{args.registry}/{image_tag}"

print("Building and pushing Docker image:", image_tag)

# Build the Docker image
print("Building Docker image...")
subprocess.run(["docker", "build", "-t", latest_image_tag, "-t", image_tag, "--platform", "linux/amd64", args.package_dir], check=True)
# Push the Docker image to the registry
print("\n\n\n\n\nPushing Docker image...")
subprocess.run(["docker", "push", latest_image_tag], check=True)
subprocess.run(["docker", "push", image_tag], check=True)

# Optionally save the Docker image as a tar archive
if args.archive_out:
    print("\n\n\n\n\nSaving Docker image to archive:", args.archive_out)
    subprocess.run(["docker", "save", image_tag, "-o", args.archive_out], check=True)

print("\n\nDone.\n\n")

