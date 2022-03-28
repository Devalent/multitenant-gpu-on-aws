#!/bin/bash

echo "ECS_CLUSTER=${name}
" >> /etc/ecs/ecs.config
# ECS_AVAILABLE_LOGGING_DRIVERS='[\"json-file\",\"awslogs\"]'
