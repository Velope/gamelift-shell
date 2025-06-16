import * as cdk from 'aws-cdk-lib';
/**
 * Stream CDK Stack Properties
 * @interface GLSInfrastructureStackProps
 */
export interface GLSInfrastructureStackProps extends cdk.StackProps {
    streamGroupId: string;
    applicationId: string;
}
/**
 * Streaming Infrastructure Stack
 * @description Deploys Lambda function with API Gateway integration for streaming
 */
export declare class GLSInfrastructureStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: GLSInfrastructureStackProps);
    private generateInstructions;
}
