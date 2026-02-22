import { test } from "node:test";
import assert from "node:assert/strict";

import { listProjectSummariesFromDynamoScan } from "../backend/api-handler.mjs";

class FakeScanCommand {
  input: Record<string, unknown>;

  constructor(input: Record<string, unknown>) {
    this.input = input;
  }
}

test("listProjectSummariesFromDynamoScan follows LastEvaluatedKey across pages", async () => {
  const scanInputs: Array<Record<string, unknown>> = [];
  const responses = [
    {
      Items: [
        {
          projectId: "project-1",
          name: "Old Project",
          ownerUserId: "user-a",
          version: 1,
          updatedAt: "2026-02-20T00:00:00.000Z"
        }
      ],
      LastEvaluatedKey: {
        pk: "PROJECT#project-1",
        sk: "META"
      }
    },
    {
      Items: [
        {
          projectId: "project-2",
          name: "New Project",
          ownerUserId: "user-b",
          version: "3",
          updatedAt: "2026-02-21T00:00:00.000Z"
        }
      ]
    }
  ];
  let responseIndex = 0;
  const fakeClient = {
    async send(command: { input: Record<string, unknown> }) {
      scanInputs.push(command.input);
      const nextResponse = responses[responseIndex];
      responseIndex += 1;
      return nextResponse;
    }
  };

  const projects = await listProjectSummariesFromDynamoScan(
    fakeClient,
    FakeScanCommand,
    "AppTable"
  );

  assert.equal(scanInputs.length, 2);
  assert.deepEqual(scanInputs[0], {
    TableName: "AppTable",
    FilterExpression: "itemType = :itemType",
    ExpressionAttributeValues: {
      ":itemType": "project"
    }
  });
  assert.deepEqual(scanInputs[1], {
    TableName: "AppTable",
    FilterExpression: "itemType = :itemType",
    ExpressionAttributeValues: {
      ":itemType": "project"
    },
    ExclusiveStartKey: {
      pk: "PROJECT#project-1",
      sk: "META"
    }
  });
  assert.deepEqual(projects, [
    {
      projectId: "project-1",
      name: "Old Project",
      ownerUserId: "user-a",
      version: 1,
      updatedAt: "2026-02-20T00:00:00.000Z"
    },
    {
      projectId: "project-2",
      name: "New Project",
      ownerUserId: "user-b",
      version: 3,
      updatedAt: "2026-02-21T00:00:00.000Z"
    }
  ]);
});
