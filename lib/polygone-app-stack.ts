import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as appsync from '@aws-cdk/aws-appsync';

export class PolygoneAppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'polygone-api',
      schema: appsync.Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY
        },
      },
    });

    // Create the VPC needed for the Aurora Serverless DB cluster
    const vpc = new ec2.Vpc(this, 'PolygoneVPC');
    // Create the Serverless Aurora DB cluster; set the engine to Postgres
    const cluster = new rds.ServerlessCluster(this, 'AuroraPolygoneCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
      defaultDatabaseName: 'PolygoneDB',
      vpc
    });

    // Create the Lambda function that will map GraphQL operations into Postgres
    const postFn = new lambda.Function(this, 'polygone-function', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: new lambda.AssetCode('lambda-fns'),
      handler: 'index.handler',
      memorySize: 1024,
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: cluster.secret?.secretArn || '',
        DB_NAME: 'PolygoneDB',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      },
    });
    // Grant access to the cluster from the Lambda function
    cluster.grantDataApiAccess(postFn);
    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', postFn);

    // Define resolvers to map GraphQL operations to the Lambda function
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'listPosts'
    });
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getPostById'
    });
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createPost'
    });
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'updatePost'
    });
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'deletePost'
    });

    // CFN Outputs
    new cdk.CfnOutput(this, 'AppSyncAPIURL', {
      value: api.graphqlUrl
    });
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey || ''
    });
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region
    });
  }
}
