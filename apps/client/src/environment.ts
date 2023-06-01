export const { VITE_HOST_NAME, VITE_CLIENT_PORT, VITE_SERVER_PORT, VITE_TLS } = import.meta.env as unknown as {
  VITE_HOST_NAME: string | undefined;
  VITE_CLIENT_PORT: number | undefined;
  VITE_SERVER_PORT: number | undefined;
  VITE_TLS: boolean | undefined;
};
if (!VITE_HOST_NAME) throw new Error("VITE_HOST_NAME is not defined");
if (!VITE_CLIENT_PORT) throw new Error("VITE_CLIENT_PORT is not defined");
if (!VITE_SERVER_PORT) throw new Error("VITE_SERVER_PORT is not defined");
if (!VITE_TLS) throw new Error("VITE_TLS is not defined");
