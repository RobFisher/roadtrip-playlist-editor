import crypto from "node:crypto";

const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const PROJECT_PK_PREFIX = "PROJECT#";
const PROJECT_NAME_PK_PREFIX = "PROJECT_NAME#";
const PROJECT_SK_META = "META";
const PROJECT_NAME_SK_LOCK = "LOCK";
const USER_PK_PREFIX = "USER#";
const USER_SK_PROFILE = "PROFILE";
const SESSION_PK_PREFIX = "SESSION#";
const SESSION_SK_META = "META";
const SESSION_COOKIE_NAME = "roadtrip_session";

const inMemoryProjectsById = new Map();
const inMemoryProjectIdByNameKey = new Map();
const inMemoryUsersById = new Map();
const inMemorySessionsById = new Map();

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function normalizeProjectName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeDisplayName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function toProjectNameKey(projectName) {
  return normalizeProjectName(projectName).toLowerCase();
}

function parseCookies(cookieHeader) {
  const cookies = {};
  const raw = String(cookieHeader ?? "");
  if (!raw) {
    return cookies;
  }
  raw.split(";").forEach((part) => {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) {
      return;
    }
    cookies[rawName] = decodeURIComponent(rest.join("=") ?? "");
  });
  return cookies;
}

function buildSetCookie(sessionId, maxAgeSeconds) {
  const secureByDefault = process.env.SESSION_COOKIE_SECURE
    ? process.env.SESSION_COOKIE_SECURE === "true"
    : Boolean(process.env.AWS_EXECUTION_ENV);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secureByDefault) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function clearCookieHeader() {
  const secureByDefault = process.env.SESSION_COOKIE_SECURE
    ? process.env.SESSION_COOKIE_SECURE === "true"
    : Boolean(process.env.AWS_EXECUTION_ENV);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (secureByDefault) {
    parts.push("Secure");
  }
  return parts.join("; ");
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

function createInMemoryStore() {
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
      const project = {
        projectId,
        name: normalizedName,
        ownerUserId: actor.userId,
        payload,
        version: 1,
        createdAt: now,
        updatedAt: now
      };
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
      const updatedProject = {
        ...project,
        name: normalizedName,
        payload,
        version: project.version + 1,
        updatedAt: new Date().toISOString()
      };
      inMemoryProjectsById.set(projectId, updatedProject);
      return { project: buildProjectDetails(updatedProject) };
    },

    async upsertUser(googleIdentity, preferredDisplayName) {
      const displayName =
        normalizeDisplayName(preferredDisplayName) ||
        normalizeDisplayName(googleIdentity.name) ||
        googleIdentity.email;
      const existing = inMemoryUsersById.get(googleIdentity.sub);
      const now = new Date().toISOString();
      const user = {
        userId: googleIdentity.sub,
        email: googleIdentity.email,
        displayName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      inMemoryUsersById.set(googleIdentity.sub, user);
      return user;
    },

    async createSession(user, ttlSeconds) {
      const sessionId = crypto.randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      inMemorySessionsById.set(sessionId, {
        sessionId,
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        expiresAt
      });
      return {
        sessionId,
        user: {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName
        },
        expiresAt
      };
    },

    async getSession(sessionId) {
      const session = inMemorySessionsById.get(sessionId);
      if (!session) {
        return null;
      }
      if (Date.parse(session.expiresAt) <= Date.now()) {
        inMemorySessionsById.delete(sessionId);
        return null;
      }
      return session;
    },

    async deleteSession(sessionId) {
      inMemorySessionsById.delete(sessionId);
    }
  };
}

async function createDynamoStore() {
  const tableName = process.env.APP_TABLE_NAME;
  if (!tableName) {
    throw new Error("APP_TABLE_NAME is required for DynamoDB store.");
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
  const dynamodbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  return {
    async listProjects() {
      const response = await dynamodbClient.send(
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
      const response = await dynamodbClient.send(
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
      const existingName = await dynamodbClient.send(
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

      await dynamodbClient.send(
        new PutCommand({
          TableName: tableName,
          Item: projectItem,
          ConditionExpression: "attribute_not_exists(pk)"
        })
      );
      try {
        await dynamodbClient.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              pk: `${PROJECT_NAME_PK_PREFIX}${nameKey}`,
              sk: PROJECT_NAME_SK_LOCK,
              itemType: "project_name",
              projectId
            },
            ConditionExpression: "attribute_not_exists(pk)"
          })
        );
      } catch (error) {
        await dynamodbClient.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              pk: projectItem.pk,
              sk: projectItem.sk
            }
          })
        );
        if (error && typeof error === "object" && "name" in error && error.name === "ConditionalCheckFailedException") {
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
        const existingName = await dynamodbClient.send(
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
      await dynamodbClient.send(
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
        await dynamodbClient.send(
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
        await dynamodbClient.send(
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
    },

    async upsertUser(googleIdentity, preferredDisplayName) {
      const now = new Date().toISOString();
      const existing = await dynamodbClient.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            pk: `${USER_PK_PREFIX}${googleIdentity.sub}`,
            sk: USER_SK_PROFILE
          }
        })
      );
      const displayName =
        normalizeDisplayName(preferredDisplayName) ||
        normalizeDisplayName(googleIdentity.name) ||
        googleIdentity.email;
      const user = {
        userId: googleIdentity.sub,
        email: googleIdentity.email,
        displayName,
        createdAt: existing.Item?.createdAt ?? now,
        updatedAt: now
      };
      await dynamodbClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: `${USER_PK_PREFIX}${googleIdentity.sub}`,
            sk: USER_SK_PROFILE,
            itemType: "user",
            ...user
          }
        })
      );
      return user;
    },

    async createSession(user, ttlSeconds) {
      const sessionId = crypto.randomBytes(24).toString("base64url");
      const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + ttlSeconds;
      const expiresAt = new Date(expiresAtEpochSeconds * 1000).toISOString();
      await dynamodbClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: `${SESSION_PK_PREFIX}${sessionId}`,
            sk: SESSION_SK_META,
            itemType: "session",
            sessionId,
            userId: user.userId,
            email: user.email,
            displayName: user.displayName,
            expiresAt,
            ttlEpochSeconds: expiresAtEpochSeconds
          }
        })
      );
      return {
        sessionId,
        user: {
          userId: user.userId,
          email: user.email,
          displayName: user.displayName
        },
        expiresAt
      };
    },

    async getSession(sessionId) {
      const response = await dynamodbClient.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            pk: `${SESSION_PK_PREFIX}${sessionId}`,
            sk: SESSION_SK_META
          }
        })
      );
      const item = response.Item;
      if (!item) {
        return null;
      }
      if (Date.parse(String(item.expiresAt)) <= Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }
      return {
        sessionId,
        userId: String(item.userId),
        email: String(item.email),
        displayName: String(item.displayName),
        expiresAt: String(item.expiresAt)
      };
    },

    async deleteSession(sessionId) {
      await dynamodbClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            pk: `${SESSION_PK_PREFIX}${sessionId}`,
            sk: SESSION_SK_META
          }
        })
      );
    }
  };
}

let cachedStorePromise = null;

async function getStore() {
  if (!cachedStorePromise) {
    const useDynamo = Boolean(process.env.AWS_EXECUTION_ENV && process.env.APP_TABLE_NAME);
    cachedStorePromise = useDynamo
      ? createDynamoStore()
      : Promise.resolve(createInMemoryStore());
  }
  return await cachedStorePromise;
}

async function verifyGoogleAccessToken(accessToken) {
  const configuredClientId = String(
    process.env.VITE_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? ""
  ).trim();
  if (!configuredClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured in backend.");
  }

  const tokenInfoResponse = await fetch(
    `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!tokenInfoResponse.ok) {
    throw new Error("Google token verification failed.");
  }
  const tokenInfo = await tokenInfoResponse.json();
  if (String(tokenInfo.aud ?? "") !== configuredClientId) {
    throw new Error("Google token audience mismatch.");
  }
  const expSeconds = Number.parseInt(String(tokenInfo.exp ?? "0"), 10);
  if (!expSeconds || expSeconds * 1000 <= Date.now()) {
    throw new Error("Google token is expired.");
  }
  const email = String(tokenInfo.email ?? "").trim();
  const sub = String(tokenInfo.sub ?? tokenInfo.user_id ?? "").trim();
  if (!email || !sub) {
    throw new Error("Google token missing required identity fields.");
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  let name = email;
  if (userInfoResponse.ok) {
    const userInfo = await userInfoResponse.json();
    name = normalizeDisplayName(userInfo.name) || email;
  }

  return {
    sub,
    email,
    name
  };
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

async function getSessionActor(event, store) {
  const headers = event?.headers ?? {};
  const cookieHeader = headers.cookie ?? headers.Cookie ?? "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = String(cookies[SESSION_COOKIE_NAME] ?? "").trim();
  if (!sessionId) {
    return null;
  }
  const session = await store.getSession(sessionId);
  if (!session) {
    return null;
  }
  return {
    sessionId,
    userId: session.userId,
    email: session.email,
    displayName: session.displayName
  };
}

function requireActor(actor) {
  if (!actor) {
    return json(401, { message: "Authentication required." });
  }
  return null;
}

export async function handler(event) {
  try {
    const method = event?.requestContext?.http?.method ?? "GET";
    const { path, projectId } = readPath(event);

    if (method === "GET" && path === "/api/health") {
      return json(200, {
        ok: true,
        env: process.env.ENV_NAME ?? "unknown",
        timestamp: new Date().toISOString()
      });
    }

    const store = await getStore();
    const actor = await getSessionActor(event, store);

    if (method === "POST" && path === "/api/auth/google/session") {
      try {
        const body = await parseJsonBody(event?.body ?? "");
        const accessToken = String(body?.accessToken ?? "").trim();
        const preferredDisplayName = normalizeDisplayName(body?.displayName ?? "");
        if (!accessToken) {
          return json(400, { message: "Google access token is required." });
        }
        const googleIdentity = await verifyGoogleAccessToken(accessToken);
        const user = await store.upsertUser(googleIdentity, preferredDisplayName);
        const sessionTtlSeconds = Number.parseInt(
          String(process.env.SESSION_TTL_SECONDS ?? "604800"),
          10
        );
        const session = await store.createSession(user, Math.max(300, sessionTtlSeconds));
        return json(
          200,
          {
            authenticated: true,
            user: {
              userId: session.user.userId,
              email: session.user.email,
              displayName: session.user.displayName
            }
          },
          {
            "set-cookie": buildSetCookie(session.sessionId, Math.max(300, sessionTtlSeconds))
          }
        );
      } catch (error) {
        return json(401, {
          message: error instanceof Error ? error.message : "Failed to authenticate with Google."
        });
      }
    }

    if (method === "POST" && path === "/api/auth/logout") {
      if (actor?.sessionId) {
        await store.deleteSession(actor.sessionId);
      }
      return json(
        200,
        { ok: true },
        {
          "set-cookie": clearCookieHeader()
        }
      );
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
      const projects = await store.listProjects();
      return json(200, { projects });
    }

    if (method === "POST" && path === "/api/projects") {
      const unauthorized = requireActor(actor);
      if (unauthorized) {
        return unauthorized;
      }
      try {
        const body = await parseJsonBody(event?.body ?? "");
        const created = await store.createProject(actor, body?.name, body?.payload);
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
      const project = await store.getProject(projectId);
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
        const updated = await store.updateProject(actor, projectId, body?.name, body?.payload);
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

    return json(404, { message: `No route for ${method} ${path}` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown server error.";
    const includeDetail = process.env.ENV_NAME === "dev";
    return json(500, {
      message: "Internal Server Error",
      ...(includeDetail ? { detail } : {})
    });
  }
}
