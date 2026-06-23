const LOG_API_URL = "http://20.244.56.144/evaluation-service/logs";
const AUTH_API_URL = "http://20.244.56.144/evaluation-service/auth";

const allowedStacks = new Set(["backend", "frontend"]);
const allowedLevels = new Set(["debug", "info", "warn", "error", "fatal"]);
const packageByStack = {
  backend: new Set([
    "cache",
    "controller",
    "cron_job",
    "db",
    "domain",
    "handler",
    "repository",
    "route",
    "service",
    "auth",
    "config",
    "middleware",
    "utils",
  ]),
  frontend: new Set([
    "api",
    "component",
    "hook",
    "page",
    "state",
    "style",
    "auth",
    "config",
    "middleware",
    "utils",
  ]),
};

function readEnv(name) {
  if (import.meta.env?.[name]) {
    return import.meta.env[name];
  }

  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name];
  }

  return "";
}

const credentials = {
  email: readEnv("VITE_TEST_SERVER_EMAIL") || readEnv("TEST_SERVER_EMAIL"),
  name: readEnv("VITE_TEST_SERVER_NAME") || readEnv("TEST_SERVER_NAME"),
  rollNo: readEnv("VITE_TEST_SERVER_ROLL_NO") || readEnv("TEST_SERVER_ROLL_NO"),
  accessCode: readEnv("VITE_TEST_SERVER_ACCESS_CODE") || readEnv("TEST_SERVER_ACCESS_CODE"),
  clientID: readEnv("VITE_TEST_SERVER_CLIENT_ID") || readEnv("TEST_SERVER_CLIENT_ID"),
  clientSecret: readEnv("VITE_TEST_SERVER_CLIENT_SECRET") || readEnv("TEST_SERVER_CLIENT_SECRET"),
};

let tokenCache = {
  accessToken: "",
  expiresAt: 0,
};

let authRetryAfter = 0;

function isValidLogInput(stack, level, pkg, message) {
  return (
    allowedStacks.has(stack) &&
    allowedLevels.has(level) &&
    packageByStack[stack]?.has(pkg) &&
    typeof message === "string" &&
    message.trim().length > 0
  );
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  if (Date.now() < authRetryAfter) {
    return "";
  }

  if (!credentials.clientID || !credentials.clientSecret) {
    return "";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  let response;
  try {
    response = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    authRetryAfter = Date.now() + 60000;
    return "";
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token ?? data.accessToken ?? "",
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 - 30000,
  };

  return tokenCache.accessToken;
}

export async function getAuthHeaders() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function Log(stack, level, pkg, message) {
  try {
    if (!isValidLogInput(stack, level, pkg, message)) {
      return false;
    }

    const authHeaders = await getAuthHeaders();
    if (!authHeaders.Authorization) {
      return false;
    }

    const response = await fetch(LOG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        stack,
        level,
        package: pkg,
        message,
      }),
    });

    return response.ok;
  } catch {
    authRetryAfter = Date.now() + 60000;
    return false;
  }
}
