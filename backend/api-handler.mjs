const PROJECT_PK_PREFIX = "PROJECT#";
const PROJECT_NAME_PK_PREFIX = "PROJECT_NAME#";
const PROJECT_SK_META = "META";
const PROJECT_NAME_SK_LOCK = "LOCK";

const inMemoryProjectsById = new Map();
const inMemoryProjectIdByNameKey = new Map();

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeProjectName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function toProjectNameKey(projectName) {
  return normalizeProjectName(projectName).toLowerCase();
}

function buildActorFromHeaders(headers) {
  const userId = String(headers["x-google-user-id"] ?? "").trim();
  if (!userId) {
    return null;
  }
  const email = String(headers["x-google-email"] ?? "").trim();
  const displayName = String(headers["x-google-display-name"] ?? "").trim();
  return {
    userId,
    email,
    displayName: displayName || email || userId
  };
}

async function parseJsonBody(rawBody) {
  if (!rawBody) {
    return null;
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("Body must be valid JSON.");
  }
}

function requireActor(actor) {
  if (!actor) {
    return json(401, { message: "Authentication required." });
  }
  return null;
}

function buildStoredProject({
  projectId,
  name,
  ownerUserId,
  payload,
  version,
  createdAt,
  updatedAt
}) {
  return {
    projectId,
    name,
    ownerUserId,
    payload,
    version,
    createdAt,
    updatedAt
  };
}

function buildProjectSummary(project) {
  return {
    projectId: project.projectId,
    name: project.name,
    ownerUserId: project.ownerUserId,
    version: project.version,
    updatedAt: project.updatedAt
  };
}

function buildProjectDetails(project) {
  return {
    ...buildProjectSummary(project),
    payload: project.payload
  };
}

function createInMemoryRepository() {
  return {
    async listProjects() {
      return [...inMemoryProjectsById.values()]
        .map((project) => buildProjectSummary(project))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getProject(projectId) {
      const project = inMemoryProjectsById.get(projectId);
      return project ? buildProjectDetails(project) : null;
    },

    async createProject(actor, name, payload) {
      const normalizedName = normalizeProjectName(name);
      const nameKey = toProjectNameKey(normalizedName);
      if (!normalizedName) {
        throw new Error("Project name is required.");
      }
      if (!payload) {
        throw new Error("Project payload is required.");
      }
      if (inMemoryProjectIdByNameKey.has(nameKey)) {
        return { conflict: true };
      }

      const projectId = `project-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const now = new Date().toISOString();
      const project = buildStoredProject({
        projectId,
        name: normalizedName,
        ownerUserId: actor.userId,
        payload,
        version: 1,
        createdAt: now,
        updatedAt: now
      });
      inMemoryProjectsById.set(projectId, project);
      inMemoryProjectIdByNameKey.set(nameKey, projectId);
      return { project: buildProjectDetails(project) };
    },

    async updateProject(actor, projectId, name, payload) {
      const project = inMemoryProjectsById.get(projectId);
      if (!project) {
        return { notFound: true };
      }
      if (project.ownerUserId !== actor.userId) {
        return { forbidden: true };
      }

      const normalizedName = normalizeProjectName(name);
      const nextNameKey = toProjectNameKey(normalizedName);
      const currentNameKey = toProjectNameKey(project.name);
      if (!normalizedName) {
        throw new Error("Project name is required.");
      }
      if (!payload) {
        throw new Error("Project payload is required.");
      }

      if (nextNameKey !== currentNameKey && inMemoryProjectIdByNameKey.has(nextNameKey)) {
        return { conflict: true };
      }

      if (nextNameKey !== currentNameKey) {
        inMemoryProjectIdByNameKey.delete(currentNameKey);
        inMemoryProjectIdByNameKey.set(nextNameKey, projectId);
      }

      const updatedProject = buildStoredProject({
        ...project,
        name: normalizedName,
        payload,
        version: project.version + 1,
        updatedAt: new Date().toISOString()
      });
      inMemoryProjectsById.set(projectId, updatedProject);
      return { project: buildProjectDetails(updatedProject) };
    }
  };
}

let cachedRepositoryPromise = null;

async function createDynamoRepository() {
  const tableName = process.env.APP_TABLE_NAME;
  if (!tableName) {
    throw new Error("APP_TABLE_NAME is required for DynamoDB repository.");
  }

  const [{ DynamoDBClient }, dynamodb] = await Promise.all([
    import("@aws-sdk/client-dynamodb"),
    import("@aws-sdk/lib-dynamodb")
  ]);

  const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    ScanCommand,
    DeleteCommand,
    UpdateCommand
  } = dynamodb;

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  return {
    async listProjects() {
      const response = await client.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: "itemType = :itemType",
          ExpressionAttributeValues: {
            ":itemType": "project"
          }
        })
      );
      const items = (response.Items ?? []).map((item) => ({
        projectId: String(item.projectId),
        name: String(item.name),
        ownerUserId: String(item.ownerUserId),
        version: Number(item.version ?? 1),
        updatedAt: String(item.updatedAt)
      }));
      return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getProject(projectId) {
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            pk: `${PROJECT_PK_PREFIX}${projectId}`,
            sk: PROJECT_SK_META
          }
        })
      );
      const item = response.Item;
      if (!item) {
        return null;
      }
      return {
        projectId: String(item.projectId),
        name: String(item.name),
        ownerUserId: String(item.ownerUserId),
        version: Number(item.version ?? 1),
        updatedAt: String(item.updatedAt),
        payload: item.payload
      };
    },

    async createProject(actor, name, payload) {
      const normalizedName = normalizeProjectName(name);
      const nameKey = toProjectNameKey(normalizedName);
      if (!normalizedName) {
        throw new Error("Project name is required.");
      }
      if (!payload) {
        throw new Error("Project payload is required.");
      }

      const existingName = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            pk: `${PROJECT_NAME_PK_PREFIX}${nameKey}`,
            sk: PROJECT_NAME_SK_LOCK
          }
        })
      );
      if (existingName.Item) {
        return { conflict: true };
      }

      const projectId = `project-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const now = new Date().toISOString();
      const projectItem = {
        pk: `${PROJECT_PK_PREFIX}${projectId}`,
        sk: PROJECT_SK_META,
        itemType: "project",
        projectId,
        name: normalizedName,
        ownerUserId: actor.userId,
        payload,
        version: 1,
        createdAt: now,
        updatedAt: now
      };
      const nameLockItem = {
        pk: `${PROJECT_NAME_PK_PREFIX}${nameKey}`,
        sk: PROJECT_NAME_SK_LOCK,
        itemType: "project_name",
        projectId
      };

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: projectItem,
          ConditionExpression: "attribute_not_exists(pk)"
        })
      );
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: nameLockItem,
            ConditionExpression: "attribute_not_exists(pk)"
          })
        );
      } catch (error) {
        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              pk: projectItem.pk,
              sk: projectItem.sk
            }
          })
        );
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "ConditionalCheckFailedException"
        ) {
          return { conflict: true };
        }
        throw error;
      }

      return {
        project: {
          projectId,
          name: normalizedName,
          ownerUserId: actor.userId,
          version: 1,
          updatedAt: now,
          payload
        }
      };
    },

    async updateProject(actor, projectId, name, payload) {
      const current = await this.getProject(projectId);
      if (!current) {
        return { notFound: true };
      }
      if (current.ownerUserId !== actor.userId) {
        return { forbidden: true };
      }
      const normalizedName = normalizeProjectName(name);
      const nextNameKey = toProjectNameKey(normalizedName);
      const currentNameKey = toProjectNameKey(current.name);
      if (!normalizedName) {
        throw new Error("Project name is required.");
      }
      if (!payload) {
        throw new Error("Project payload is required.");
      }

      if (nextNameKey !== currentNameKey) {
        const existingName = await client.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              pk: `${PROJECT_NAME_PK_PREFIX}${nextNameKey}`,
              sk: PROJECT_NAME_SK_LOCK
            }
          })
        );
        if (existingName.Item) {
          return { conflict: true };
        }
      }

      const now = new Date().toISOString();
      const nextVersion = current.version + 1;

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            pk: `${PROJECT_PK_PREFIX}${projectId}`,
            sk: PROJECT_SK_META
          },
          UpdateExpression:
            "SET #name = :name, #payload = :payload, #version = :version, #updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#name": "name",
            "#payload": "payload",
            "#version": "version",
            "#updatedAt": "updatedAt"
          },
          ExpressionAttributeValues: {
            ":name": normalizedName,
            ":payload": payload,
            ":version": nextVersion,
            ":updatedAt": now
          }
        })
      );

      if (nextNameKey !== currentNameKey) {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              pk: `${PROJECT_NAME_PK_PREFIX}${nextNameKey}`,
              sk: PROJECT_NAME_SK_LOCK,
              itemType: "project_name",
              projectId
            },
            ConditionExpression: "attribute_not_exists(pk)"
          })
        );
        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              pk: `${PROJECT_NAME_PK_PREFIX}${currentNameKey}`,
              sk: PROJECT_NAME_SK_LOCK
            }
          })
        );
      }

      return {
        project: {
          projectId,
          name: normalizedName,
          ownerUserId: actor.userId,
          version: nextVersion,
          updatedAt: now,
          payload
        }
      };
    }
  };
}

async function getRepository() {
  if (!cachedRepositoryPromise) {
    const useDynamo = Boolean(process.env.AWS_EXECUTION_ENV && process.env.APP_TABLE_NAME);
    cachedRepositoryPromise = useDynamo
      ? createDynamoRepository()
      : Promise.resolve(createInMemoryRepository());
  }
  return await cachedRepositoryPromise;
}

function readHeaders(event) {
  const headers = event?.headers ?? {};
  const normalized = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = String(value ?? "");
  });
  return normalized;
}

function readPath(event) {
  const path = event?.rawPath ?? "/";
  const requestPath = String(path);
  const projectMatch = requestPath.match(/^\/api\/projects\/([^/]+)$/);
  return {
    path: requestPath,
    projectId: projectMatch ? decodeURIComponent(projectMatch[1]) : null
  };
}

export async function handler(event) {
  const method = event?.requestContext?.http?.method ?? "GET";
  const headers = readHeaders(event);
  const actor = buildActorFromHeaders(headers);
  const { path, projectId } = readPath(event);
  const repository = await getRepository();

  if (method === "GET" && path === "/api/health") {
    return json(200, {
      ok: true,
      env: process.env.ENV_NAME ?? "unknown",
      timestamp: new Date().toISOString()
    });
  }

  if (method === "GET" && path === "/api/me") {
    if (!actor) {
      return json(200, { authenticated: false, user: null });
    }
    return json(200, {
      authenticated: true,
      user: {
        userId: actor.userId,
        email: actor.email,
        displayName: actor.displayName
      }
    });
  }

  if (method === "GET" && path === "/api/projects") {
    const unauthorized = requireActor(actor);
    if (unauthorized) {
      return unauthorized;
    }
    const projects = await repository.listProjects();
    return json(200, { projects });
  }

  if (method === "POST" && path === "/api/projects") {
    const unauthorized = requireActor(actor);
    if (unauthorized) {
      return unauthorized;
    }
    try {
      const body = await parseJsonBody(event?.body ?? "");
      const name = body?.name;
      const payload = body?.payload;
      const created = await repository.createProject(actor, name, payload);
      if (created.conflict) {
        return json(409, { message: "Project name is already in use." });
      }
      return json(201, { project: created.project });
    } catch (error) {
      return json(400, {
        message: error instanceof Error ? error.message : "Invalid request."
      });
    }
  }

  if (projectId && method === "GET") {
    const unauthorized = requireActor(actor);
    if (unauthorized) {
      return unauthorized;
    }
    const project = await repository.getProject(projectId);
    if (!project) {
      return json(404, { message: "Project not found." });
    }
    return json(200, { project });
  }

  if (projectId && method === "PUT") {
    const unauthorized = requireActor(actor);
    if (unauthorized) {
      return unauthorized;
    }
    try {
      const body = await parseJsonBody(event?.body ?? "");
      const name = body?.name;
      const payload = body?.payload;
      const updated = await repository.updateProject(actor, projectId, name, payload);
      if (updated.notFound) {
        return json(404, { message: "Project not found." });
      }
      if (updated.forbidden) {
        return json(403, {
          message:
            "Only the project owner can save changes. Save with a new unique name to create your own copy."
        });
      }
      if (updated.conflict) {
        return json(409, { message: "Project name is already in use." });
      }
      return json(200, { project: updated.project });
    } catch (error) {
      return json(400, {
        message: error instanceof Error ? error.message : "Invalid request."
      });
    }
  }

  return json(404, {
    message: `No route for ${method} ${path}`
  });
}
