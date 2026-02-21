import { existsSync, readFileSync } from "node:fs";
import { App } from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack.js";
import { FrontendStack } from "../lib/frontend-stack.js";

function loadDotEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, "utf-8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION;
const env = account && region ? { account, region } : undefined;

const backendStack = new BackendStack(app, "RoadtripPlaylistEditorBackend-dev", {
  envName: "dev",
  ...(env ? { env } : {})
});

new FrontendStack(app, "RoadtripPlaylistEditor-dev", {
  envName: "dev",
  apiOriginDomainName: backendStack.apiDomainName,
  ...(env ? { env } : {})
});
