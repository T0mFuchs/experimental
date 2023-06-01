import { file, write } from "bun";
import { existsSync, mkdir } from "node:fs";

const file_name = process.env.ROOT_FILE || "index.ts";

const initial_timestamp = Date.now();
const initial_lines = await file(`./${file_name}`)
  .text()
  .catch(console.error)
  .then((text) => {
    if (typeof text === "string") return text.split("\n");
  });
if (!initial_lines) {
  console.error("initial_lines:", initial_lines);
  throw new Error("initial_lines is not defined");
}

const output_lines = [];
for (const line of initial_lines) {
  const trimmed_line = line.trim();
  //* remove comments
  if (trimmed_line.startsWith("//")) continue;
  //* remove console.log's
  if (trimmed_line.startsWith("console.log")) continue;
  //* remove debug routes
  if (trimmed_line.includes("router")) continue;
  output_lines.push(trimmed_line);
}

const output = output_lines.join("\n");
const output_file = file(`./dist/${file_name}`);

const on_success = () => {
  console.log(
    `\n > production script successfully executed in ${
      Date.now() - initial_timestamp
    }ms \n > output: ./dist/${file_name}\n`
  );
};



if (existsSync("./dist")) {
  await write(output_file, output).catch(console.error).then(on_success);
} else {
  mkdir("./dist", async (error) => {
    if (error) throw error;
    await write(output_file, output).catch(console.error).then(on_success);
  });
}
