
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as cdk from 'aws-cdk-lib';
import { GLSInfrastructureStack, GLSInfrastructureStackProps } from '../lib/gls-infrastructure-stack';

const app = new cdk.App();

// Validate Stream Group ID
const streamGroupId = process.env.STREAM_GROUP_ID;
if (!streamGroupId || !streamGroupId.match(/^sg-[a-zA-Z0-9]{5,}$/)) {
  throw new Error('Valid STREAM_GROUP_ID environment variable is required (format: sg-XXXXX...)');
}

new GLSInfrastructureStack(app, 'gameliftstreams-share-url-cdk', {
  streamGroupId: streamGroupId,
  applicationId: 'your-application-id',
  awsRegion: 'us-east-2', // Replace with the desired AWS region
} as GLSInfrastructureStackProps);
