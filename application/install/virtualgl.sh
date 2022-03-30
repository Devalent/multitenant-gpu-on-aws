#!/bin/bash

wget --no-verbose -O virtualgl.deb https://sourceforge.net/projects/virtualgl/files/2.6.5/virtualgl_2.6.5_amd64.deb/download \
    && apt install -y ./virtualgl.deb \
    && rm virtualgl.deb \
    && /opt/VirtualGL/bin/vglserver_config -config +s +f -t
