import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_s3_deployment as s3deployment } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudFront Origin Access Identity
    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, "rs-school-task-OAI")

    // S3 bucket
    const bucketName = "rs-school-task-s3"
    const webIndexDocument = "index.html"

    const siteBucket = new s3.Bucket(this, bucketName, {
      bucketName: bucketName,
      websiteIndexDocument: webIndexDocument,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true
    });

    new cdk.CfnOutput(this, "Bucket", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "BucketURL", { value: siteBucket.bucketWebsiteUrl });

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${siteBucket.bucketArn}/*`],
        principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
      })
    );

    // CloudFront
    const distribution = new cloudfront.CloudFrontWebDistribution(this, "rs-school-task-cf", {
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: siteBucket,
          originAccessIdentity: cloudfrontOAI
        },
        behaviors: [{ isDefaultBehavior: true }]
      }],
      errorConfigurations: [{
        errorCode: 404,
        responseCode: 200,
        responsePagePath: `/${webIndexDocument}`
      }]
    });

    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });

    new cdk.CfnOutput(this, "DomainName", { value: distribution.distributionDomainName });

    // S3 Deployment
    new s3deployment.BucketDeployment(this, "rs-school-task-bucket-deploy", {
      sources: [s3deployment.Source.asset("../dist")],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/*"]
    });
  }
}
