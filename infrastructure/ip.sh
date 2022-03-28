#!/bin/bash

IDS=$(aws autoscaling describe-auto-scaling-instances --region $AWS_REGION --query AutoScalingInstances[].InstanceId --output text)

echo "Instance IP: $(aws ec2 describe-instances --instance-ids $IDS --region $AWS_REGION --filters "Name=instance-state-name,Values=running" "Name=instance.group-name,Values=$SG_NAME" --query Reservations[].Instances[].PublicIpAddress --output text)"
