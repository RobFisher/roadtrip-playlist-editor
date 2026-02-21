import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface FrontendStackProps extends StackProps {
  envName: string;
  apiOriginDomainName?: string;
}

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteBucket = new Bucket(this, "SiteBucket", {
      bucketName: undefined,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const spaRewriteFunction = new CloudFrontFunction(this, "SpaRewriteFunction", {
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri || "/";
  if (uri.startsWith("/api/")) {
    return request;
  }
  if (uri === "/" || uri === "") {
    request.uri = "/index.html";
    return request;
  }
  if (uri.lastIndexOf(".") === -1) {
    request.uri = "/index.html";
  }
  return request;
}
`)
    });

    const distribution = new Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: spaRewriteFunction,
            eventType: FunctionEventType.VIEWER_REQUEST
          }
        ]
      },
      additionalBehaviors: props.apiOriginDomainName
        ? {
            "/api/*": {
              origin: new HttpOrigin(props.apiOriginDomainName, {
                protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
              }),
              viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              allowedMethods: AllowedMethods.ALLOW_ALL,
              cachePolicy: CachePolicy.CACHING_DISABLED,
              originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
            }
          }
        : undefined,
      errorResponses: []
    });

    new BucketDeployment(this, "DeployFrontend", {
      sources: [Source.asset("dist")],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"]
    });

    new CfnOutput(this, "Environment", {
      value: props.envName
    });

    new CfnOutput(this, "BucketName", {
      value: siteBucket.bucketName
    });

    new CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.distributionDomainName
    });
  }
}
