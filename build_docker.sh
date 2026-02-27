#!/bin/sh
docker build -t "mxbolt/botc-clocktower:latest" --platform linux/amd64 . && docker save "mxbolt/botc-clocktower:latest" -o mxbolt-botc-clocktower.tar