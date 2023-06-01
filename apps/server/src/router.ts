import { Hono } from "hono";
import { SQL, lt } from "drizzle-orm";
import { subs } from "./schema";
import { sqlite_client, sqlite_database, libsql_client } from "index";

const router = new Hono();

router.get("/", async (context) => {
  return context.html(
    `<div style="padding: .5em"><b> debug routes enabled </b></div>`
  );
});

router.get("/clean", (context) => {
  sqlite_database
      .delete(subs)
      //* remove subscriptions older than 1 hour
      .where(lt(subs.t, Date.now() - 1000 * 60 * 60))
      .run()
  context.status(200);
  return context.text("success");
});

router.get("/subs", async (context) => {
  try {
    context.status(200);
    return context.json(
      sqlite_client.prepare("SELECT * FROM s").all()
    );
  } catch (error) {
    console.error(error);
  }
});

router.get("/ips", async (context) => {
  try {
    context.status(200);
    return context.json(
      sqlite_client.prepare("SELECT * FROM i").all()
    );
  } catch (error) {
    console.error(error);
  }
});

router.post("/unb",async  (context) => {
  const body = await context.req.text();
  sqlite_client.run(`UPDATE i SET b = 0 WHERE i = ${body}`)
  console.log(`unbanned ${body}`)
  context.status(200);
  return context.text(`success`);
})

router.get("/folders", async (context) => {
  try {
    context.status(200);
    return context.json(
      await libsql_client
        .execute("SELECT * FROM f")
        .then((result) => result.rows)
    );
  } catch (error) {
    context.status(500);
    console.error(error);
  }
});

export { router };
