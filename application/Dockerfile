# CUDA 11.4 matches the runtime at the latest AWS ECS-optimized AMI for GPU instances
# https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html
# Use the development version to be able to reference headers during FFmpeg build
FROM nvidia/cuda:11.4.0-devel-ubuntu20.04

ARG DEBIAN_FRONTEND=noninteractive

ENV NVIDIA_DRIVER_CAPABILITIES=all
ENV PORT=3000
ENV NODE_ENV=develop

RUN apt-get update -y && apt-get install -y curl wget

# FFmpeg, build from source and include NVIDIA codecs
COPY ./install/ffmpeg.sh ~/install/ffmpeg.sh
RUN bash -e ~/install/ffmpeg.sh

# VirtualGL
COPY ./install/virtualgl.sh ~/install/virtualgl.sh
RUN bash -e ~/install/virtualgl.sh

# Chrome dependencies
COPY ./install/chrome.sh ~/install/chrome.sh
RUN bash -e ~/install/chrome.sh

# Utilities
COPY ./install/utils.sh ~/install/utils.sh
RUN bash -e ~/install/utils.sh

# Node.js
COPY ./install/node.sh ~/install/node.sh
RUN bash -e ~/install/node.sh

# Application
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm i

ADD . .

RUN npm run build && rm -rf src
# RUN rm -rf node_modules && npm ci
RUN chmod -R o+rwx node_modules/puppeteer/.local-chromium

CMD npm start
