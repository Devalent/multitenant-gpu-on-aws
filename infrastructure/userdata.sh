#!/bin/bash
echo "ECS_CLUSTER=${name}\nECS_AVAILABLE_LOGGING_DRIVERS='[\"json-file\",\"awslogs\"]'" >> /etc/ecs/ecs.config
