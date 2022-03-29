#!/usr/bin/env zx

import 'zx/globals';

const image = 'multitenant-gpu';

await $`docker build --platform linux/amd64 -t ${image} .`;
await $`docker run --platform linux/amd64 --rm -p 3000 -i -t ${image}`;
