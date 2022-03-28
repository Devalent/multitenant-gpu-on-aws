#!/bin/bash

REPOSITORY=artema
IMAGE=multitenant-gpu
TAG=latest

docker build --platform linux/amd64 -t $IMAGE .
docker tag $IMAGE $REPOSITORY/$IMAGE:$TAG
docker push $REPOSITORY/$IMAGE:$TAG
