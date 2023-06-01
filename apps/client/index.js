// TODO migrate from express to hono | priority: low | speed up install / deploy times
import express from "express";
import { readFile } from "node:fs/promises";
import "dotenv/config";

// eslint-disable-next-line no-undef
const { NODE_ENV, VITE_HOST_NAME, VITE_CLIENT_PORT } = process.env;
const isProduction = NODE_ENV === "production";
if (!VITE_HOST_NAME) throw new Error("VITE_HOST_NAME is not defined");
if (!VITE_CLIENT_PORT) throw new Error("VITE_CLIENT_PORT is not defined");
const BASE = "/";
const app = express();

const html = isProduction
  ? await readFile("./dist/index.html", "utf8")
  : await readFile("./index.html", "utf8");

let vite;
if (isProduction) {
  // eslint-disable-next-line unicorn/no-await-expression-member
  const compression = (await import("compression")).default;
  app.use(compression());
  app.use("/", express.static("./dist"));
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base: BASE,
  });
  app.use(vite.middlewares);
}

app.use("*", async (request, response) => {
  try {
    const url = request.originalUrl.replace(BASE, "");
    let template;
    template = isProduction ? html : (await vite.transformIndexHtml(url, html));
    response.status(200).set({ "Content-Type": "text/html" }).end(template);
  } catch (error) {
    console.log(error);
    response.status(500).end(error);
  }
});

app.listen(Number.parseInt(VITE_CLIENT_PORT), () => {
  console.log(`Client running on ${VITE_HOST_NAME}:${VITE_CLIENT_PORT}`);
})
