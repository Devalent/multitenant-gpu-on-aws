#!/usr/bin/env zx

import 'zx/globals';
import { echo } from 'zx/experimental'

const region = process.env.AWS_REGION;

if (!region) {
  throw 'AWS_REGION is not set.';
}

const sg = process.env.SG_NAME;

if (!sg) {
  throw 'SG_NAME is not set.';
}

const ids = await quiet($`aws autoscaling describe-auto-scaling-instances --region ${region} --query AutoScalingInstances[].InstanceId --output text`);
const instances = ids.stdout.replace('\n', '').split('\t').filter(x => x);

const { stdout:ips } = await quiet($`aws ec2 describe-instances --instance-ids ${instances} --region ${region} --filters "Name=instance-state-name,Values=running" "Name=instance.group-name,Values=${sg}" --query Reservations[].Instances[].PublicIpAddress --output text`);

if (ips) {
  echo`Instance IP: ${ips}`;
} else {
  echo`Instance not found.`;
}
