/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

/**
 * Stream CDK Stack Properties
 * @interface GLSInfrastructureStackProps
 */
export interface GLSInfrastructureStackProps extends cdk.StackProps {
  streamGroupId: string;    // Stream group identifier
  applicationId: string;    // application identifier
}

/**
 * Streaming Infrastructure Stack
 * @description Deploys Lambda function with API Gateway integration for streaming
 */
export class GLSInfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: GLSInfrastructureStackProps) {
    super(scope, id, props);

    // Create Lambda function with security best practices and optimal performance settings
    // Security: Using Node.js 18.x for latest security updates and features
    // Security: ARM64 architecture for better performance and security
    // Security: X-Ray tracing enabled for monitoring and debugging
    // Security: Log retention set for compliance and auditing
    const serverLambda = new lambda.Function(this, 'GameLiftStreamsServerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,  // Using LTS version for stability and security
      code: lambda.Code.fromAsset(path.join(__dirname, '../server')),
      handler: 'server.handler',
      memorySize: 512,  // Allocated memory for Lambda execution
      timeout: cdk.Duration.seconds(300),  // 5-minute timeout for long-running operations
      environment: {
        // Environment variables for configuration
        STREAM_GROUP_ID: props.streamGroupId,
        APPLICATION_ID: props.applicationId,
        NODE_OPTIONS: '--enable-source-maps'  // Enable source maps for better error tracking
      },
      architecture: lambda.Architecture.ARM_64,  // Using ARM for better performance/cost
      tracing: lambda.Tracing.ACTIVE,  // Enable X-Ray tracing for request tracking
      logRetention: RetentionDays.ONE_MONTH,  // Retain logs for auditing purposes
    });

    // Configure IAM permissions for Lambda function
    // Security: Following principle of least privilege while maintaining functionality
    // Note: Resources are set to '*' to support customer deployment flexibility
    serverLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'gameliftstreams:StartStreamSession',
        'gameliftstreams:GetStreamSession',
        'gameliftstreams:TerminateStreamSession',
      ],
      resources: [
        'arn:aws:gameliftstreams:*:*:application/*',
        `arn:aws:gameliftstreams:*:*:streamgroup/${props.streamGroupId}`
      ]
    }));    

    // Create API Gateway with security configurations
    // Security: CORS configured for development flexibility
    // Security: Logging and tracing enabled for monitoring
    const api = new apigateway.RestApi(this, 'GameLiftStreamsShareUrlApi', {
      restApiName: 'GameLiftStreams Share Api',
      description: 'API for the GameLiftStreams Share application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,  // Configurable per environment
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        maxAge: cdk.Duration.days(1)  // Cache CORS preflight requests
      },
      // Enable comprehensive logging and monitoring
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        tracingEnabled: true,
      }
    });

    // Configure Lambda integration with API Gateway
    // Security: Timeout set to maximum allowed by API Gateway
    const lambdaIntegration = new apigateway.LambdaIntegration(serverLambda, {
      proxy: true,
      timeout: cdk.Duration.seconds(29)  // Maximum allowed API Gateway timeout
    });

    // Helper function to add methods with consistent security configurations
    // Security: Proper response headers and status codes
    const addMethod = (resource: apigateway.IResource, httpMethod: string) => {
      resource.addMethod(httpMethod, lambdaIntegration, {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              // Security headers for browser protection
              'method.response.header.Content-Type': true,
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true
            }
          },
          { statusCode: '400' },  // Bad request response
          { statusCode: '500' }   // Server error response
        ]
      });
    };

    // Configure API routes
    // Root path handler
    addMethod(api.root, 'ANY');
    
    // Define specific API endpoints
    const apiResource = api.root.addResource('api');
    addMethod(apiResource.addResource('CreateStreamSession'), 'POST');
    addMethod(apiResource.addResource('GetSignalResponse'), 'POST');
    addMethod(apiResource.addResource('DestroyStreamSession'), 'POST');

    // Add catch-all proxy for unmatched routes
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true
    });

    // Output usage instructions
    new cdk.CfnOutput(this, 'Instructions', {
      value: this.generateInstructions(api.url, props.streamGroupId, props.applicationId),
      description: 'Instructions for using the GameLiftStreams Share URL',
    });
  }

  // Helper method to generate user instructions
  private generateInstructions(apiUrl: string, streamGroupId: string, applicationId: string): string {
    return `
                                Instructions                                   


  Here is your Amazon GameLift Streams Share URL:                                                                                                                                                                    
  ${apiUrl}?userId=Player1&applicationId=${applicationId}&location=us-east-2
  
  Add or update arguments to your URL to share your stream:                             
  ?userId={Add Player Name}&applicationId={Add Application ID}&location={Add AWS Region} 

    `.trim();
  }
}

  // Validate Stream Group ID
  function validateStreamGroupId(id: string): string {
    if (!id.match(/^sg-[a-zA-Z0-9]{9,}$/)) {
      throw new Error('Invalid Stream Group ID format. Must match pattern: At least 9 alphanumeric characters after sg-');
    }
      return id;
  }

  // Initialize the CDK app with environment-specific configuration
  const app = new cdk.App();

  // Get and validate Stream Group ID
  const streamGroupId = validateStreamGroupId(
    process.env.STREAM_GROUP_ID || 'sg-000000000'
  );

  new GLSInfrastructureStack(app, 'GameLiftStreamsGLSInfrastructureStack', {
    streamGroupId: streamGroupId,
    applicationId: process.env.APPLICATION_ID || 'a-000000000',
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
  },
});
