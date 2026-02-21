import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  AttributeType,
  BillingMode,
  Table
} from "aws-cdk-lib/aws-dynamodb";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Runtime, Function as LambdaFunction, Code } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface BackendStackProps extends StackProps {
  envName: string;
}

function parseCorsAllowedOrigins(rawValue: string | undefined): string[] {
  const fromEnv = String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/g, ""))
    .filter((value) => value.length > 0);

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return ["http://127.0.0.1:5173"];
}

export class BackendStack extends Stack {
  public readonly apiBaseUrl: string;
  public readonly apiDomainName: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const appTable = new Table(this, "AppTable", {
      tableName: undefined,
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttlEpochSeconds",
      removalPolicy: RemovalPolicy.DESTROY
    });

    appTable.addGlobalSecondaryIndex({
      indexName: "gsi1",
      partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: AttributeType.STRING }
    });

    const apiHandler = new LambdaFunction(this, "ApiHandler", {
      runtime: Runtime.NODEJS_22_X,
      handler: "api-handler.handler",
      code: Code.fromAsset("backend"),
      timeout: Duration.seconds(15),
      memorySize: 256,
      environment: {
        APP_TABLE_NAME: appTable.tableName,
        ENV_NAME: props.envName,
        VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID ?? "",
        SESSION_TTL_SECONDS: "604800",
        SESSION_COOKIE_SAME_SITE: "None",
        SESSION_COOKIE_SECURE: "true"
      }
    });

    appTable.grantReadWriteData(apiHandler);

    const api = new HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: parseCorsAllowedOrigins(process.env.BACKEND_CORS_ALLOWED_ORIGINS),
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.OPTIONS
        ],
        allowHeaders: [
          "content-type",
          "authorization"
        ],
        allowCredentials: true
      }
    });

    const integration = new HttpLambdaIntegration("ApiHandlerIntegration", apiHandler);
    api.addRoutes({
      path: "/api/health",
      methods: [HttpMethod.GET],
      integration
    });
    api.addRoutes({
      path: "/api/me",
      methods: [HttpMethod.GET],
      integration
    });
    api.addRoutes({
      path: "/api/debug/session",
      methods: [HttpMethod.GET],
      integration
    });
    api.addRoutes({
      path: "/api/auth/google/session",
      methods: [HttpMethod.POST],
      integration
    });
    api.addRoutes({
      path: "/api/auth/logout",
      methods: [HttpMethod.POST],
      integration
    });
    api.addRoutes({
      path: "/api/projects",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration
    });
    api.addRoutes({
      path: "/api/projects/{projectId}",
      methods: [HttpMethod.GET, HttpMethod.PUT],
      integration
    });

    this.apiBaseUrl = api.apiEndpoint;
    this.apiDomainName = Fn.select(2, Fn.split("/", api.apiEndpoint));

    new CfnOutput(this, "Environment", {
      value: props.envName
    });
    new CfnOutput(this, "AppTableName", {
      value: appTable.tableName
    });
    new CfnOutput(this, "ApiBaseUrl", {
      value: api.apiEndpoint
    });
  }
}
