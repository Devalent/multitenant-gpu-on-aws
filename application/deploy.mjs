#!/usr/bin/env zx

const fullName = process.env.DOCKER_IMAGE;

if (!fullName) {
  throw `DOCKER_IMAGE variable is not set.`;
}

const [repository, imageAndTag] = fullName.split('/');
const [image, tag] = imageAndTag.split(':');

await $`docker pull ${fullName} || true`;
await $`docker build --platform linux/amd64 --cache-from ${fullName} -t ${image} .`;
await $`docker tag ${image} ${fullName}`;
await $`docker push ${fullName}`;
