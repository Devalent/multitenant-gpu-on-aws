import {
  EC2Client,
  DescribeAvailabilityZonesCommand,
  DescribeInstanceTypesCommand,
  DescribeKeyPairsCommand,
} from '@aws-sdk/client-ec2';
import {
  SSMClient,
  GetParameterCommand,
} from '@aws-sdk/client-ssm';
import * as aws from '@pulumi/aws';
import * as fs from 'fs';

import {
  name,
  tags,
  tagsList,
  region,
  instanceType,
  webPort,
  sshKey,
  dockerImage,
  myIp,
} from './config';

const ec2client = new EC2Client({ region });
const ssmClient = new SSMClient({ region });

const vpc = aws.ec2.getVpc({ default: true });

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

const keyPair = sshKey
  ? ec2client
      .send(new DescribeKeyPairsCommand({
        KeyNames: [sshKey],
      }))
      .then((res) => {
        if (!!res.KeyPairs) {
          return res.KeyPairs[0].KeyName!;
        }

        console.warn(`Key ${sshKey} not found.`);

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

const myIpMask = myIp.then(x => `${x}/32`);

const securityGroup = new aws.ec2.SecurityGroup('ec2-security-group', {
  tags,
  name,
  vpcId: vpc.then(x => x.id),
  ingress: [
    {
      fromPort: webPort,
      toPort: webPort,
      protocol: 'TCP',
      cidrBlocks: [`0.0.0.0/0`],
    },
    {
      fromPort: 22,
      toPort: 22,
      protocol: 'TCP',
      cidrBlocks: [myIpMask],
    },
  ],
  egress: [
    {
      fromPort: 0,
      toPort: 0,
      protocol: '-1',
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
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
  userData: Buffer.from(
    fs.readFileSync('./userdata.sh').toString('utf-8').replace('${name}', name)
  ).toString('base64'),
  vpcSecurityGroupIds: [securityGroup.id],
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
  defaultCapacityProviderStrategies: [
    {
      capacityProvider: capacityProvider.name,
      weight: 100,
    },
  ],
});

const task = new aws.ecs.TaskDefinition('ecs-task', {
  tags,
  family: name,
  memory: instanceInfo.then(x => Math.round(x.MemoryInfo!.SizeInMiB! * 0.8).toString()),
  containerDefinitions: JSON.stringify([{
    name: 'worker',
    image: dockerImage,
    essential: true,
    portMappings: [
      {
        containerPort: 3000,
        hostPort: webPort,
      },
    ],
    environment: [
      {
        name: 'NODE_ENV',
        value: 'production',
      },
    ],
    healthCheck: {
      command: ['CMD-SHELL', `curl http://localhost:3000/ || exit 1`],
      startPeriod: 10,
    },
    resourceRequirements: [
      {
        type: 'GPU',
        value: '1',
      },
    ],
    // logConfiguration: {
    //   logDriver: 'awslogs',
    //   options: {
    //     "awslogs-group": name,
    //     "awslogs-region": region,
    //     "awslogs-create-group": 'true',
    //   },
    // },
  }]),
});

new aws.ecs.Service('ecs-service', {
  tags,
  name,
  cluster: cluster.arn,
  taskDefinition: task.arn,
  schedulingStrategy: 'DAEMON',
  forceNewDeployment: true,
});
