FROM nvidia/cuda:11.4.0-devel-ubuntu20.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y curl wget

# FFmpeg
RUN apt-get update -y && apt-get -y install autoconf automake build-essential libass-dev libtool libssl-dev pkg-config git \
    texinfo zlib1g-dev cmake mercurial libbz2-dev rtmpdump librtmp-dev libunistring2 libunistring-dev opencl-headers ocl-icd-* \
    && mkdir -p /opt/ffmpeg \
    && mkdir -p ~/ffmpeg_sources \
    && cd ~/ffmpeg_sources \
    && git clone https://github.com/FFmpeg/nv-codec-headers \
    && cd nv-codec-headers \
    && git checkout origin/sdk/11.0 \
    && make \
    && make install PREFIX="/opt/ffmpeg_build" \
    && cd ~/ffmpeg_sources \
    && wget https://www.nasm.us/pub/nasm/releasebuilds/2.14.02/nasm-2.14.02.tar.gz \
    && tar xzvf nasm-2.14.02.tar.gz \
    && cd nasm-2.14.02 \
    && ./configure --prefix="/opt/ffmpeg_build" --bindir="/opt/ffmpeg/bin" \
    && make -j$(nproc) VERBOSE=1 \
    && make -j$(nproc) install \
    && make -j$(nproc) distclean \
    && cd ~/ffmpeg_sources \
    && git clone http://git.videolan.org/git/x264.git \
    && cd x264 \
    && PATH="/opt/ffmpeg/bin:$PATH" ./configure --prefix="/opt/ffmpeg_build" --enable-static --enable-shared \
    && PATH="/opt/ffmpeg/bin:$PATH" make -j$(nproc) VERBOSE=1 \
    && make -j$(nproc) install VERBOSE=1 \
    && make -j$(nproc) distclean \
    && cd ~/ffmpeg_sources \
    && git clone https://bitbucket.org/multicoreware/x265_git.git \
    && cd ~/ffmpeg_sources/x265_git/build/linux \
    && PATH="/opt/ffmpeg/bin:$PATH" cmake -G "Unix Makefiles" -DCMAKE_INSTALL_PREFIX="/opt/ffmpeg_build" -DENABLE_SHARED:bool=off ../../source \
    && make -j$(nproc) VERBOSE=1 \
    && make -j$(nproc) install VERBOSE=1 \
    && make -j$(nproc) clean VERBOSE=1 \
    && cd ~/ffmpeg_sources \
    && wget -O fdk-aac.tar.gz https://github.com/mstorsjo/fdk-aac/tarball/master \
    && tar xzvf fdk-aac.tar.gz \
    && cd mstorsjo-fdk-aac* \
    && autoreconf -fiv \
    && ./configure --prefix="/opt/ffmpeg_build" --disable-shared \
    && make -j$(nproc) \
    && make -j$(nproc) install \
    && make -j$(nproc) distclean \
    && echo /opt/ffmpeg_build/lib > /etc/ld.so.conf.d/ffmpeg.conf \
    && ldconfig -vvvv \
    && cd ~/ffmpeg_sources \ 
    && git clone https://github.com/FFmpeg/FFmpeg -b master \
    && cd FFmpeg \
    && PATH="/opt/ffmpeg/bin:$PATH" PKG_CONFIG_PATH="/opt/ffmpeg_build/lib/pkgconfig" ./configure \
        --pkg-config-flags="--static" \
        --prefix="/opt/ffmpeg" \
        --bindir="/opt/ffmpeg/bin" \
        --extra-cflags="-I/opt/ffmpeg_build/include" \
        --extra-ldflags="-L/opt/ffmpeg_build/lib" \
        --enable-cuda \
        --enable-cuda-nvcc \
        --enable-cuvid \
        --enable-libnpp \
        --extra-cflags="-I/usr/local/cuda/include/" \
        --extra-ldflags=-L/usr/local/cuda/lib64/ \
        --enable-nvenc \
        --enable-nvdec \
        --enable-libass \
        --disable-debug \
        --enable-opencl \
        --enable-gpl \
        --cpu=native \
        --enable-libfdk-aac \
        --enable-libx264 \
        --enable-openssl \
        --enable-librtmp \
        --extra-libs="-lpthread -lm -lz" \
        --enable-nonfree \
    && PATH="/opt/ffmpeg/bin:$PATH" make -j$(nproc) \
    && make -j$(nproc) install \
    && make -j$(nproc) distclean \
    && ln -sf /opt/ffmpeg/bin/ffmpeg /usr/bin/ffmpeg \
    && rm -rf ~/ffmpeg_sources

# VirtualGL
RUN wget --no-verbose -O virtualgl.deb https://sourceforge.net/projects/virtualgl/files/2.6.5/virtualgl_2.6.5_amd64.deb/download \
    && apt install -y ./virtualgl.deb \
    && rm virtualgl.deb \
    && /opt/VirtualGL/bin/vglserver_config -config +s +f -t

# Chrome dependencies
RUN apt-get install -y fonts-liberation gconf-service libappindicator1 libasound2 libatk1.0-0 libcairo2 libcups2 libfontconfig1 \
    libgbm-dev libgdk-pixbuf2.0-0 libgtk-3-0 libicu-dev libjpeg-dev libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libpng-dev libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 xdg-utils

# Chrome
# RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
#     && apt install -y ./google-chrome-stable_current_amd64.deb \
#     && rm google-chrome-stable_current_amd64.deb

# Utilities
RUN apt-get install -y xvfb fluxbox unclutter

# Node.js
RUN wget --no-verbose -O n https://raw.githubusercontent.com/tj/n/master/bin/n \
    && bash n 16 \
    && rm n

# Application
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm i

ADD . .

RUN npm run build && rm -rf src
# RUN rm -rf node_modules && npm ci
RUN chmod -R o+rwx node_modules/puppeteer/.local-chromium

ENV NODE_ENV=develop
ENV PORT=3000

CMD npm start
