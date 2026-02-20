import { App } from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack.js";
import { FrontendStack } from "../lib/frontend-stack.js";

const app = new App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
};

new BackendStack(app, "RoadtripPlaylistEditorBackend-dev", {
  envName: "dev",
  env
});

new FrontendStack(app, "RoadtripPlaylistEditor-dev", {
  envName: "dev",
  env
});
