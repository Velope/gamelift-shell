"use strict";
/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLSInfrastructureStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const iam = require("aws-cdk-lib/aws-iam");
const path = require("path");
const aws_logs_1 = require("aws-cdk-lib/aws-logs");
/**
 * Streaming Infrastructure Stack
 * @description Deploys Lambda function with API Gateway integration for streaming
 */
class GLSInfrastructureStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create Lambda function with security best practices and optimal performance settings
        // Security: Using Node.js 18.x for latest security updates and features
        // Security: ARM64 architecture for better performance and security
        // Security: X-Ray tracing enabled for monitoring and debugging
        // Security: Log retention set for compliance and auditing
        const serverLambda = new lambda.Function(this, 'GameLiftStreamsServerLambda', {
            runtime: lambda.Runtime.NODEJS_18_X, // Using LTS version for stability and security
            code: lambda.Code.fromAsset(path.join(__dirname, '../server')),
            handler: 'server.handler',
            memorySize: 512, // Allocated memory for Lambda execution
            timeout: cdk.Duration.seconds(300), // 5-minute timeout for long-running operations
            environment: {
                // Environment variables for configuration
                STREAM_GROUP_ID: props.streamGroupId,
                APPLICATION_ID: props.applicationId,
                NODE_OPTIONS: '--enable-source-maps' // Enable source maps for better error tracking
            },
            architecture: lambda.Architecture.ARM_64, // Using ARM for better performance/cost
            tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing for request tracking
            logRetention: aws_logs_1.RetentionDays.ONE_MONTH, // Retain logs for auditing purposes
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
                allowOrigins: apigateway.Cors.ALL_ORIGINS, // Configurable per environment
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token'
                ],
                maxAge: cdk.Duration.days(1) // Cache CORS preflight requests
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
            timeout: cdk.Duration.seconds(29) // Maximum allowed API Gateway timeout
        });
        // Helper function to add methods with consistent security configurations
        // Security: Proper response headers and status codes
        const addMethod = (resource, httpMethod) => {
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
                    { statusCode: '400' }, // Bad request response
                    { statusCode: '500' } // Server error response
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
    generateInstructions(apiUrl, streamGroupId, applicationId) {
        return `
                                Instructions                                   


  Here is your Amazon GameLift Streams Share URL:                                                                                                                                                                    
  ${apiUrl}?userId=Player1&applicationId=${applicationId}&location=us-east-2
  
  Add or update arguments to your URL to share your stream:                             
  ?userId={Add Player Name}&applicationId={Add Application ID}&location={Add AWS Region} 

    `.trim();
    }
}
exports.GLSInfrastructureStack = GLSInfrastructureStack;
// Validate Stream Group ID
function validateStreamGroupId(id) {
    if (!id.match(/^sg-[a-zA-Z0-9]{9,}$/)) {
        throw new Error('Invalid Stream Group ID format. Must match pattern: At least 9 alphanumeric characters after sg-');
    }
    return id;
}
// Initialize the CDK app with environment-specific configuration
const app = new cdk.App();
// Get and validate Stream Group ID
const streamGroupId = validateStreamGroupId(process.env.STREAM_GROUP_ID || 'sg-000000000');
new GLSInfrastructureStack(app, 'GameLiftStreamsGLSInfrastructureStack', {
    streamGroupId: streamGroupId,
    applicationId: process.env.APPLICATION_ID || 'a-000000000',
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xzLWluZnJhc3RydWN0dXJlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ2xzLWluZnJhc3RydWN0dXJlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILG1DQUFtQztBQUVuQyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELDJDQUEyQztBQUMzQyw2QkFBNkI7QUFDN0IsbURBQXFEO0FBV3JEOzs7R0FHRztBQUNILE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFjLEVBQUUsRUFBVSxFQUFFLEtBQWtDO1FBQ3hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVGQUF1RjtRQUN2Rix3RUFBd0U7UUFDeEUsbUVBQW1FO1FBQ25FLCtEQUErRDtRQUMvRCwwREFBMEQ7UUFDMUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUM1RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUcsK0NBQStDO1lBQ3JGLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUM5RCxPQUFPLEVBQUUsZ0JBQWdCO1lBQ3pCLFVBQVUsRUFBRSxHQUFHLEVBQUcsd0NBQXdDO1lBQzFELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRywrQ0FBK0M7WUFDcEYsV0FBVyxFQUFFO2dCQUNYLDBDQUEwQztnQkFDMUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxhQUFhO2dCQUNwQyxjQUFjLEVBQUUsS0FBSyxDQUFDLGFBQWE7Z0JBQ25DLFlBQVksRUFBRSxzQkFBc0IsQ0FBRSwrQ0FBK0M7YUFDdEY7WUFD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QUFDO0FBRTFCLG1DQUFtQztBQUNuQyxNQUFNLGFBQWEsR0FBRyxxQkFBcUIsQ0FDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLElBQUksY0FBYyxDQUM5QyxDQUFDO0FBRUYsSUFBSSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsdUNBQXVDLEVBQUU7SUFDdkUsYUFBYSxFQUFFLGFBQWE7SUFDNUIsYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxJQUFJLGFBQWE7SUFDMUQsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQjtLQUN6QztDQUNGLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBDb3B5cmlnaHQgQW1hem9uLmNvbSwgSW5jLiBvciBpdHMgYWZmaWxpYXRlcy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVQtMFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBTdGFjayB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFJldGVudGlvbkRheXMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5cbi8qKlxuICogU3RyZWFtIENESyBTdGFjayBQcm9wZXJ0aWVzXG4gKiBAaW50ZXJmYWNlIEdMU0luZnJhc3RydWN0dXJlU3RhY2tQcm9wc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEdMU0luZnJhc3RydWN0dXJlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RyZWFtR3JvdXBJZDogc3RyaW5nOyAgICAvLyBTdHJlYW0gZ3JvdXAgaWRlbnRpZmllclxuICBhcHBsaWNhdGlvbklkOiBzdHJpbmc7ICAgIC8vIGFwcGxpY2F0aW9uIGlkZW50aWZpZXJcbn1cblxuLyoqXG4gKiBTdHJlYW1pbmcgSW5mcmFzdHJ1Y3R1cmUgU3RhY2tcbiAqIEBkZXNjcmlwdGlvbiBEZXBsb3lzIExhbWJkYSBmdW5jdGlvbiB3aXRoIEFQSSBHYXRld2F5IGludGVncmF0aW9uIGZvciBzdHJlYW1pbmdcbiAqL1xuZXhwb3J0IGNsYXNzIEdMU0luZnJhc3RydWN0dXJlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM6IEdMU0luZnJhc3RydWN0dXJlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiB3aXRoIHNlY3VyaXR5IGJlc3QgcHJhY3RpY2VzIGFuZCBvcHRpbWFsIHBlcmZvcm1hbmNlIHNldHRpbmdzXG4gICAgLy8gU2VjdXJpdHk6IFVzaW5nIE5vZGUuanMgMTgueCBmb3IgbGF0ZXN0IHNlY3VyaXR5IHVwZGF0ZXMgYW5kIGZlYXR1cmVzXG4gICAgLy8gU2VjdXJpdHk6IEFSTTY0IGFyY2hpdGVjdHVyZSBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlIGFuZCBzZWN1cml0eVxuICAgIC8vIFNlY3VyaXR5OiBYLVJheSB0cmFjaW5nIGVuYWJsZWQgZm9yIG1vbml0b3JpbmcgYW5kIGRlYnVnZ2luZ1xuICAgIC8vIFNlY3VyaXR5OiBMb2cgcmV0ZW50aW9uIHNldCBmb3IgY29tcGxpYW5jZSBhbmQgYXVkaXRpbmdcbiAgICBjb25zdCBzZXJ2ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHYW1lTGlmdFN0cmVhbXNTZXJ2ZXJMYW1iZGEnLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCwgIC8vIFVzaW5nIExUUyB2ZXJzaW9uIGZvciBzdGFiaWxpdHkgYW5kIHNlY3VyaXR5XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3NlcnZlcicpKSxcbiAgICAgIGhhbmRsZXI6ICdzZXJ2ZXIuaGFuZGxlcicsXG4gICAgICBtZW1vcnlTaXplOiA1MTIsICAvLyBBbGxvY2F0ZWQgbWVtb3J5IGZvciBMYW1iZGEgZXhlY3V0aW9uXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLCAgLy8gNS1taW51dGUgdGltZW91dCBmb3IgbG9uZy1ydW5uaW5nIG9wZXJhdGlvbnNcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC8vIEVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgY29uZmlndXJhdGlvblxuICAgICAgICBTVFJFQU1fR1JPVVBfSUQ6IHByb3BzLnN0cmVhbUdyb3VwSWQsXG4gICAgICAgIEFQUExJQ0FUSU9OX0lEOiBwcm9wcy5hcHBsaWNhdGlvbklkLFxuICAgICAgICBOT0RFX09QVElPTlM6ICctLWVuYWJsZS1zb3VyY2UtbWFwcycgIC8vIEVuYWJsZSBzb3VyY2UgbWFwcyBmb3IgYmV0dGVyIGVycm9yIHRyYWNraW5nXG4gICAgICB9LFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCwgIC8vIFVzaW5nIEFSTSBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlL2Nvc3RcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSwgIC8vIEVuYWJsZSBYLVJheSB0cmFjaW5nIGZvciByZXF1ZXN0IHRyYWNraW5nXG4gICAgICBsb2dSZXRlbnRpb246IFJldGVudGlvbkRheXMuT05FX01PTlRILCAgLy8gUmV0YWluIGxvZ3MgZm9yIGF1ZGl0aW5nIHB1cnBvc2VzXG4gICAgfSk7XG5cbiAgICAvLyBDb25maWd1cmUgSUFNIHBlcm1pc3Npb25zIGZvciBMYW1iZGEgZnVuY3Rpb25cbiAgICAvLyBTZWN1cml0eTogRm9sbG93aW5nIHByaW5jaXBsZSBvZiBsZWFzdCBwcml2aWxlZ2Ugd2hpbGUgbWFpbnRhaW5pbmcgZnVuY3Rpb25hbGl0eVxuICAgIC8vIE5vdGU6IFJlc291cmNlcyBhcmUgc2V0IHRvICcqJyB0byBzdXBwb3J0IGN1c3RvbWVyIGRlcGxveW1lbnQgZmxleGliaWxpdHlcbiAgICBzZXJ2ZXJMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2dhbWVsaWZ0c3RyZWFtczpTdGFydFN0cmVhbVNlc3Npb24nLFxuICAgICAgICAnZ2FtZWxpZnRzdHJlYW1zOkdldFN0cmVhbVNlc3Npb24nLFxuICAgICAgICAnZ2FtZWxpZnRzdHJlYW1zOlRlcm1pbmF0ZVN0cmVhbVNlc3Npb24nLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICAnYXJuOmF3czpnYW1lbGlmdHN0cmVhbXM6KjoqOmFwcGxpY2F0aW9uLyonLFxuICAgICAgICBgYXJuOmF3czpnYW1lbGlmdHN0cmVhbXM6KjoqOnN0cmVhbWdyb3VwLyR7cHJvcHMuc3RyZWFtR3JvdXBJZH1gXG4gICAgICBdXG4gICAgfSkpOyAgICBcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheSB3aXRoIHNlY3VyaXR5IGNvbmZpZ3VyYXRpb25zXG4gICAgLy8gU2VjdXJpdHk6IENPUlMgY29uZmlndXJlZCBmb3IgZGV2ZWxvcG1lbnQgZmxleGliaWxpdHlcbiAgICAvLyBTZWN1cml0eTogTG9nZ2luZyBhbmQgdHJhY2luZyBlbmFibGVkIGZvciBtb25pdG9yaW5nXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnR2FtZUxpZnRTdHJlYW1zU2hhcmVVcmxBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ0dhbWVMaWZ0U3RyZWFtcyBTaGFyZSBBcGknLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIHRoZSBHYW1lTGlmdFN0cmVhbXMgU2hhcmUgYXBwbGljYXRpb24nLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLCAgLy8gQ29uZmlndXJhYmxlIHBlciBlbnZpcm9ubWVudFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nXG4gICAgICAgIF0sXG4gICAgICAgIG1heEFnZTogY2RrLkR1cmF0aW9uLmRheXMoMSkgIC8vIENhY2hlIENPUlMgcHJlZmxpZ2h0IHJlcXVlc3RzXG4gICAgICB9LFxuICAgICAgLy8gRW5hYmxlIGNvbXByZWhlbnNpdmUgbG9nZ2luZyBhbmQgbW9uaXRvcmluZ1xuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ29uZmlndXJlIExhbWJkYSBpbnRlZ3JhdGlvbiB3aXRoIEFQSSBHYXRld2F5XG4gICAgLy8gU2VjdXJpdHk6IFRpbWVvdXQgc2V0IHRvIG1heGltdW0gYWxsb3dlZCBieSBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGxhbWJkYUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc2VydmVyTGFtYmRhLCB7XG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDI5KSAgLy8gTWF4aW11bSBhbGxvd2VkIEFQSSBHYXRld2F5IHRpbWVvdXRcbiAgICB9KTtcblxuICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBhZGQgbWV0aG9kcyB3aXRoIGNvbnNpc3RlbnQgc2VjdXJpdHkgY29uZmlndXJhdGlvbnNcbiAgICAvLyBTZWN1cml0eTogUHJvcGVyIHJlc3BvbnNlIGhlYWRlcnMgYW5kIHN0YXR1cyBjb2Rlc1xuICAgIGNvbnN0IGFkZE1ldGhvZCA9IChyZXNvdXJjZTogYXBpZ2F0ZXdheS5JUmVzb3VyY2UsIGh0dHBNZXRob2Q6IHN0cmluZykgPT4ge1xuICAgICAgcmVzb3VyY2UuYWRkTWV0aG9kKGh0dHBNZXRob2QsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgIC8vIFNlY3VyaXR5IGhlYWRlcnMgZm9yIGJyb3dzZXIgcHJvdGVjdGlvblxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGUnOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgc3RhdHVzQ29kZTogJzQwMCcgfSwgIC8vIEJhZCByZXF1ZXN0IHJlc3BvbnNlXG4gICAgICAgICAgeyBzdGF0dXNDb2RlOiAnNTAwJyB9ICAgLy8gU2VydmVyIGVycm9yIHJlc3BvbnNlXG4gICAgICAgIF1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBDb25maWd1cmUgQVBJIHJvdXRlc1xuICAgIC8vIFJvb3QgcGF0aCBoYW5kbGVyXG4gICAgYWRkTWV0aG9kKGFwaS5yb290LCAnQU5ZJyk7XG4gICAgXG4gICAgLy8gRGVmaW5lIHNwZWNpZmljIEFQSSBlbmRwb2ludHNcbiAgICBjb25zdCBhcGlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhcGknKTtcbiAgICBhZGRNZXRob2QoYXBpUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ0NyZWF0ZVN0cmVhbVNlc3Npb24nKSwgJ1BPU1QnKTtcbiAgICBhZGRNZXRob2QoYXBpUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ0dldFNpZ25hbFJlc3BvbnNlJyksICdQT1NUJyk7XG4gICAgYWRkTWV0aG9kKGFwaVJlc291cmNlLmFkZFJlc291cmNlKCdEZXN0cm95U3RyZWFtU2Vzc2lvbicpLCAnUE9TVCcpO1xuXG4gICAgLy8gQWRkIGNhdGNoLWFsbCBwcm94eSBmb3IgdW5tYXRjaGVkIHJvdXRlc1xuICAgIGFwaS5yb290LmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogbGFtYmRhSW50ZWdyYXRpb24sXG4gICAgICBhbnlNZXRob2Q6IHRydWVcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCB1c2FnZSBpbnN0cnVjdGlvbnNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW5zdHJ1Y3Rpb25zJywge1xuICAgICAgdmFsdWU6IHRoaXMuZ2VuZXJhdGVJbnN0cnVjdGlvbnMoYXBpLnVybCwgcHJvcHMuc3RyZWFtR3JvdXBJZCwgcHJvcHMuYXBwbGljYXRpb25JZCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0luc3RydWN0aW9ucyBmb3IgdXNpbmcgdGhlIEdhbWVMaWZ0U3RyZWFtcyBTaGFyZSBVUkwnLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gSGVscGVyIG1ldGhvZCB0byBnZW5lcmF0ZSB1c2VyIGluc3RydWN0aW9uc1xuICBwcml2YXRlIGdlbmVyYXRlSW5zdHJ1Y3Rpb25zKGFwaVVybDogc3RyaW5nLCBzdHJlYW1Hcm91cElkOiBzdHJpbmcsIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSW5zdHJ1Y3Rpb25zICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcblxuXG4gIEhlcmUgaXMgeW91ciBBbWF6b24gR2FtZUxpZnQgU3RyZWFtcyBTaGFyZSBVUkw6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgJHthcGlVcmx9P3VzZXJJZD1QbGF5ZXIxJmFwcGxpY2F0aW9uSWQ9JHthcHBsaWNhdGlvbklkfSZsb2NhdGlvbj11cy1lYXN0LTJcbiAgXG4gIEFkZCBvciB1cGRhdGUgYXJndW1lbnRzIHRvIHlvdXIgVVJMIHRvIHNoYXJlIHlvdXIgc3RyZWFtOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gID91c2VySWQ9e0FkZCBQbGF5ZXIgTmFtZX0mYXBwbGljYXRpb25JZD17QWRkIEFwcGxpY2F0aW9uIElEfSZsb2NhdGlvbj17QWRkIEFXUyBSZWdpb259IFxuXG4gICAgYC50cmltKCk7XG4gIH1cbn1cblxuICAvLyBWYWxpZGF0ZSBTdHJlYW0gR3JvdXAgSURcbiAgZnVuY3Rpb24gdmFsaWRhdGVTdHJlYW1Hcm91cElkKGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghaWQubWF0Y2goL15zZy1bYS16QS1aMC05XXs5LH0kLykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBTdHJlYW0gR3JvdXAgSUQgZm9ybWF0LiBNdXN0IG1hdGNoIHBhdHRlcm46IEF0IGxlYXN0IDkgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMgYWZ0ZXIgc2ctJyk7XG4gICAgfVxuICAgICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgQ0RLIGFwcCB3aXRoIGVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbiAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuICAvLyBHZXQgYW5kIHZhbGlkYXRlIFN0cmVhbSBHcm91cCBJRFxuICBjb25zdCBzdHJlYW1Hcm91cElkID0gdmFsaWRhdGVTdHJlYW1Hcm91cElkKFxuICAgIHByb2Nlc3MuZW52LlNUUkVBTV9HUk9VUF9JRCB8fCAnc2ctMDAwMDAwMDAwJ1xuICApO1xuXG4gIG5ldyBHTFNJbmZyYXN0cnVjdHVyZVN0YWNrKGFwcCwgJ0dhbWVMaWZ0U3RyZWFtc0dMU0luZnJhc3RydWN0dXJlU3RhY2snLCB7XG4gICAgc3RyZWFtR3JvdXBJZDogc3RyZWFtR3JvdXBJZCxcbiAgICBhcHBsaWNhdGlvbklkOiBwcm9jZXNzLmVudi5BUFBMSUNBVElPTl9JRCB8fCAnYS0wMDAwMDAwMDAnLFxuICAgIGVudjoge1xuICAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICB9LFxufSk7XG4iXX0=