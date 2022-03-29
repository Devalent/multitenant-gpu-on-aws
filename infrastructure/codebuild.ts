import * as aws from '@pulumi/aws';

import {
  dockerImage,
  dockerToken,
  dockerUser,
  name,
  tags,
  useCi,
} from './config';

type CodeBuildOptions = {
  path:string;
  spec?:string;
};

if (useCi) {
  if (!dockerUser) {
    throw `Pulumi config variable "docker_user" is required for CI.`;
  }

  if (!dockerToken) {
    throw `Pulumi config variable "docker_token" is required for CI.`;
  }

  const repository = new aws.codecommit.Repository('git-repository', {
    tags,
    repositoryName: name,
    defaultBranch: 'main',
  });

  const dockerHubToken = new aws.ssm.Parameter(`docker-hub-token`, {
    type: 'String',
    value: dockerToken || '',
  });

  const buildRole = new aws.iam.Role(`codecommit-role`, {
    tags,
    name: `${name}-ci`,
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'codebuild.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    },
  });

  new aws.iam.RolePolicyAttachment(`codecommit-policy-1`, {
    role: buildRole,
    policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
  });

  const createBuildServer = (project:string, options?:CodeBuildOptions) => {
    const { path, spec } = options || {};
  
    const buildProject =
      new aws.codebuild.Project(`codebuild-project`, {
        tags,
        name: `${name}-${project}`,
        serviceRole: buildRole.arn,
        sourceVersion: `main`,
        source: {
          type: 'CODECOMMIT',
          location: repository.cloneUrlHttp,
          gitCloneDepth: 1,
          buildspec: `${path}/${spec || 'buildspec.yml'}`,
        },
        environment: {
          computeType: 'BUILD_GENERAL1_SMALL',
          image: 'aws/codebuild/standard:5.0',
          imagePullCredentialsType: 'CODEBUILD',
          type: 'LINUX_CONTAINER',
          privilegedMode: true,
          environmentVariables: [
            {
              name: 'DOCKER_IMAGE',
              value: dockerImage,
            },
            {
              name: 'DOCKER_USER',
              value: dockerUser || '',
            },
            {
              type: 'PARAMETER_STORE',
              name: 'DOCKER_TOKEN',
              value: dockerHubToken.name,
            },
          ],
        },
        artifacts: {
          type: 'NO_ARTIFACTS',
        },
      });
  
    return buildProject;
  };

  createBuildServer('application', { path: 'application' });
}
