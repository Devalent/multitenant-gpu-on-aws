import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import axios from 'axios';

const config = new pulumi.Config();

export const name = pulumi.getProject();
export const region = aws.config.region;

export const tags: { [x: string]: string; } = { stack: name };
export const tagsList = Object.keys(tags).map(x => ({ key: x, value: tags[x], propagateAtLaunch: true }));

export const webPort = config.requireNumber('web_port');
export const instanceType = config.require('instance_type');
export const sshKey = config.require('ssh_key');
export const dockerImage = config.require('docker_image');
export const dockerUser = config.get('docker_user');
export const dockerToken = config.get('docker_token');
export const useCi = !!config.getBoolean('ci');

export const myIp = axios('https://api.ipify.org?format=json')
  .then(x => x.data['ip'])
  .catch(() => {
    console.error('Unable to get your IP address.');
    return '0.0.0.0';
  });
