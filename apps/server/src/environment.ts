export const {
  NODE_ENV,
  DATABASE_URL,
  DATABASE_AUTH_TOKEN,
  SQLITE_DB_NAME,
  VITE_SERVER_PORT,
  VITE_HOST_NAME,
  VITE_TLS,
} = process.env as unknown as {
  NODE_ENV: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
  SQLITE_DB_NAME: string | undefined;
  VITE_SERVER_PORT: number;
  VITE_HOST_NAME: string;
  VITE_TLS: boolean;
};

if (!NODE_ENV) throw new Error("NODE_ENV not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
if (!DATABASE_AUTH_TOKEN) throw new Error("DATABASE_AUTH_TOKEN not set");
if (!SQLITE_DB_NAME) throw new Error("SQLITE_DB_NAME not set");
if (!VITE_SERVER_PORT) throw new Error("VITE_SERVER_PORT not set");
if (!VITE_HOST_NAME) throw new Error("VITE_HOST_NAME not set");
if (!VITE_TLS) throw new Error("VITE_TLS is not defined");

export const libsql_config = {
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN,
};
