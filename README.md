# Multi-Tenant GPU-Accelerated AWS Application Example

Reference implementation of a multi-tenant GPU-accelerated application, packaged as a Docker container and intended to be used on AWS NVIDIA-powered instances. See [this blog post](https://devalent.com/blog/multitenant-gpu-accelerated-aws-applications/) for an in-depth explanation.

<p align="center">
  <img src="./img.png?raw=true" alt="" />
</p>

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [Pulumi](https://www.pulumi.com/)
- [AWS CLI](https://aws.amazon.com/cli/)

## Project structure

### [application](./application)

Dockerized Node.js application. Can run on any platform, but is intended to work properly on Linux with NVIDIA drivers (455.28 or newer) installed and accessible from within Docker.

npm commands:

* `npm run docker` - run the application in Docker locally. Provide with `NODE_ENV=production` environment variable to leverage the GPU acceleration;
* `npm run deploy` - build a Docker container and deploy Docker Hub. Customize the `DOCKER_IMAGE` environment variable to deploy to a custom repository.

Provides the following APIs:

* `http://$IP/gpu` - prints the Chrome GPU report;
* `http://$IP/benchmark` - runs the [Basemark](https://web.basemark.com/) benchmark and prints the results (can take several minutes to complete);
* `http://$IP/record?duration=60&width=1920&height=1080&url=$URL` - recordd a video of the webpage.

### [infrastructure](./infrastructure)

Pulumi project with AWS infrastructure definition. Does not incur any hourly costs unless an EC2 instance is launched manually (see below).

npm commands:

* `npm run deploy` - deploy the infrastructure to AWS (Oregon region);
* `npm run up` - launch the EC2 instance;
* `npm run down` - shutdown the EC2 instance;
* `npm run ip` - get the IP address of the running instance (if any).

You can also set the `ci` variable to `true` in the Pulumi stack config in order to deploy a CodeBuild CI project. It will also require `docker_user` and `docker_token` variables to authenticate with Docker Hub and `docker_image` with the image name like so:

```
pulumi config set ci true
pulumi config set docker_user mydockerhubuser
pulumi config set --secret docker_token mydockerhubtoken
pulumi config set docker_image mydockerhubuser/myrepository:latest
```

`ssh_key` is the name of EC2 Key Pair that will be assigned to your instances for SSH access. EC2 security group will automatically limit the access to port 22 to your current IP address at the time of deployment.
