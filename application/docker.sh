#!/bin/bash

IMAGE=multitenant-gpu

docker build --platform linux/amd64 -t $IMAGE .
docker run --platform linux/amd64 --rm -p 3000 -i -t $IMAGE
