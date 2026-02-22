import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function withDefault(value, defaultValue) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : defaultValue;
}

function assertMatch(value, regex, message) {
  if (!regex.test(value)) {
    throw new Error(message);
  }
}

async function promptInputs() {
  const rl = readline.createInterface({ input, output });
  try {
    const accountId = withDefault(
      await rl.question("AWS account ID (12 digits): "),
      ""
    );
    assertMatch(accountId, /^\d{12}$/, "Account ID must be exactly 12 digits.");

    const primaryRegion = withDefault(
      await rl.question("Primary deploy region (for example eu-west-1): "),
      ""
    );
    assertMatch(
      primaryRegion,
      /^[a-z]{2}-[a-z]+-\d$/,
      "Region must look like us-east-1 or eu-west-1."
    );

    const cdkQualifier = withDefault(
      await rl.question("CDK bootstrap qualifier [hnb659fds]: "),
      "hnb659fds"
    );
    assertMatch(
      cdkQualifier,
      /^[a-z0-9]+$/,
      "CDK qualifier must be lowercase letters/numbers only."
    );

    const backendLambdaPrefix = withDefault(
      await rl.question(
        "Backend Lambda name prefix [RoadtripPlaylistEditorBackend-dev-ApiHandler]: "
      ),
      "RoadtripPlaylistEditorBackend-dev-ApiHandler"
    );
    assertMatch(
      backendLambdaPrefix,
      /^[A-Za-z0-9-_]+$/,
      "Lambda prefix may only contain letters, numbers, hyphen, underscore."
    );

    const outputPath = (
      await rl.question(
        "Output path (leave blank to print only) [aws_deployer_role_policy.generated.json]: "
      )
    ).trim();

    return {
      accountId,
      primaryRegion,
      cdkQualifier,
      backendLambdaPrefix,
      outputPath
    };
  } finally {
    rl.close();
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function fillTemplate(templateText, values) {
  return templateText
    .replaceAll("{{ACCOUNT_ID}}", values.accountId)
    .replaceAll("{{PRIMARY_REGION}}", values.primaryRegion)
    .replaceAll("{{CDK_QUALIFIER}}", values.cdkQualifier)
    .replaceAll("{{BACKEND_LAMBDA_PREFIX}}", values.backendLambdaPrefix);
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const templatePath = path.join(repoRoot, "aws_deployer_role_template.json");

  const args = parseArgs(process.argv.slice(2));
  const hasAllCliInputs =
    typeof args["account-id"] === "string" &&
    typeof args.region === "string";

  const inputs = hasAllCliInputs
    ? {
        accountId: args["account-id"],
        primaryRegion: args.region,
        cdkQualifier: withDefault(String(args.qualifier ?? ""), "hnb659fds"),
        backendLambdaPrefix: withDefault(
          String(args["lambda-prefix"] ?? ""),
          "RoadtripPlaylistEditorBackend-dev-ApiHandler"
        ),
        outputPath: args["no-write"] === "true"
          ? ""
          : withDefault(String(args.output ?? ""), "aws_deployer_role_policy.generated.json")
      }
    : await promptInputs();

  assertMatch(inputs.accountId, /^\d{12}$/, "Account ID must be exactly 12 digits.");
  assertMatch(
    inputs.primaryRegion,
    /^[a-z]{2}-[a-z]+-\d$/,
    "Region must look like us-east-1 or eu-west-1."
  );
  assertMatch(
    inputs.cdkQualifier,
    /^[a-z0-9]+$/,
    "CDK qualifier must be lowercase letters/numbers only."
  );
  assertMatch(
    inputs.backendLambdaPrefix,
    /^[A-Za-z0-9-_]+$/,
    "Lambda prefix may only contain letters, numbers, hyphen, underscore."
  );
  const templateText = await readFile(templatePath, "utf-8");
  const rendered = fillTemplate(templateText, inputs);
  const parsed = JSON.parse(rendered);
  const normalized = `${JSON.stringify(parsed, null, 2)}\n`;

  if (inputs.outputPath.trim().length > 0) {
    const outPath = path.isAbsolute(inputs.outputPath)
      ? inputs.outputPath
      : path.join(repoRoot, inputs.outputPath);
    await writeFile(outPath, normalized, "utf-8");
    output.write(`\nWrote policy JSON to ${outPath}\n`);
  }

  output.write("\nPaste this policy JSON into the role policy editor:\n\n");
  output.write(normalized);
}

main().catch((error) => {
  output.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
