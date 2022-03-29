#!/usr/bin/env zx

const repository = 'artema';
const image = 'multitenant-gpu';
const tag = 'latest';

await $`docker build --platform linux/amd64 -t ${image} .`;
await $`docker tag ${image} ${repository}/${image}:${tag}`;
await $`docker push ${repository}/${image}:${tag}`;
