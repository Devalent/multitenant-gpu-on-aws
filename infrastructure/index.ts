import {
  EC2Client,
  DescribeAvailabilityZonesCommand,
  DescribeInstanceTypesCommand,
  DescribeKeyPairsCommand,
} from '@aws-sdk/client-ec2';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';

const config = new pulumi.Config();

const region = aws.config.region;
const name = 'multitenant-gpu';
const tags: { [x: string]: string; } = { stack: name };
const tagsList = Object.keys(tags).map(x => ({ key: x, value: tags[x], propagateAtLaunch: true }));

const ec2client = new EC2Client({ region });
const ssmClient = new SSMClient({ region });

const vpc = aws.ec2.getVpc({ default: true });

const instanceType = config.require('instance');
const instanceInfo = ec2client
  .send(new DescribeInstanceTypesCommand({
    InstanceTypes: [instanceType],
  }))
  .then(async (res) => {
    const [ instance ] = res.InstanceTypes || [];

    if (!instance) {
      throw `Instance type ${instanceType} not found.`;
    }

    return instance;
  });

const keyPair = config.get('key')
  ? ec2client
      .send(new DescribeKeyPairsCommand({
        KeyNames: [config.require('key')],
      }))
      .then((res) => {
        if (!!res.KeyPairs) {
          return res.KeyPairs[0].KeyName!;
        }

        console.warn(`Key ${config.require('key')} not found.`);

        return undefined;
      })
      .catch((error) => {
        if (error.Name === '') {
          return undefined;
        }

        return Promise.reject(error);
      })
  : Promise.resolve(undefined);

const instanceRole = new aws.iam.Role('ec2-role', {
  tags,
  name,
  assumeRolePolicy: {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'ec2.amazonaws.com',
        },
        Action: 'sts:AssumeRole',
      },
    ],
  },
  inlinePolicies: [
    {
      name: 'inline-policy-1',
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
            ],
            Resource: `arn:aws:s3:::*`,
          },
        ],
      }),
    }
  ],
});

new aws.iam.PolicyAttachment('ec2-role-attachment-1', {
  policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role',
  roles: [instanceRole],
});

const instanceProfile = new aws.iam.InstanceProfile('ec2-profile', {
  tags,
  name,
  role: instanceRole,
});

const launchTemplate = new aws.ec2.LaunchTemplate('ec2-template', {
  tags,
  name,
  instanceType,
  imageId: ssmClient
    .send(new GetParameterCommand({ Name: '/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended' }))
    .then(x => JSON.parse(x.Parameter!.Value!).image_id),
  iamInstanceProfile: {
    arn: instanceProfile.arn,
  },
  keyName: keyPair.then(x => x!),
  userData: Buffer.from(fs.readFileSync('./userdata.sh')).toString('base64'),
});

const autoscalingGroup = new aws.autoscaling.Group('ec2-autoscaling-group', {
  name,
  launchTemplate: {
    id: launchTemplate.id,
    version: '$Latest',
  },
  tags: tagsList,
  minSize: 0,
  maxSize: 1,
  availabilityZones: ec2client
    .send(new DescribeAvailabilityZonesCommand({}))
    .then((res) => res.AvailabilityZones!.map(x => x.ZoneName!)),
});

const cluster = new aws.ecs.Cluster('ecs-cluster', {
  tags,
  name,
});

const capacityProvider = new aws.ecs.CapacityProvider('ecs-capacity', {
  tags,
  name,
  autoScalingGroupProvider: {
    autoScalingGroupArn: autoscalingGroup.arn,
    // managedScaling: {
      
    // }
  },
});

new aws.ecs.ClusterCapacityProviders('ecs-cluster-capacity', {
  clusterName: cluster.name,
  capacityProviders: [
    capacityProvider.name,
  ],
});

const task = new aws.ecs.TaskDefinition('ecs-task', {
  tags,
  family: name,
  memory: instanceInfo.then(x => Math.round(x.MemoryInfo!.SizeInMiB! * 0.8).toString()),
  containerDefinitions: JSON.stringify([{
    name: 'worker',
    image: config.require('image'),
    essential: true,
  }]),
});

const service = new aws.ecs.Service('ecs-service', {
  tags,
  name,
  cluster: cluster.arn,
  // capacityProviderStrategies: [
  //   {
  //     capacityProvider: capacityProvider.name,
  //     weight: 100,
  //   },
  // ],
  taskDefinition: task.arn,
  schedulingStrategy: 'DAEMON',
  forceNewDeployment: true,
  // placementConstraints: [
  //   {
  //     type: 'memberOf',
  //     expression: pulumi.interpolate`task:group == ${name}`,
  //   },
  // ],
});
