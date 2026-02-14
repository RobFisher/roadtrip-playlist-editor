import { App } from "aws-cdk-lib";
import { FrontendStack } from "../lib/frontend-stack.js";

const app = new App();

new FrontendStack(app, "RoadtripPlaylistEditor-dev", {
  envName: "dev",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
