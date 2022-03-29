#!/usr/bin/env zx

const repository = 'artema';
const image = 'multitenant-gpu';
const tag = 'latest';
const fullName = `${repository}/${image}:${tag}`;

await $`docker pull ${fullName} || true`;
await $`docker build --platform linux/amd64 --cache-from ${fullName} -t ${image} .`;
await $`docker tag ${image} ${fullName}`;
await $`docker push ${fullName}`;
