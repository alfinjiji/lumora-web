import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import YAML from "yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";
const spec = YAML.parse(readFileSync("contracts/openapi.yaml", "utf8"), {
  maxAliasCount: 10000,
});
const resolve = (s) =>
  s?.$ref ? resolve(spec.components.schemas[s.$ref.split("/").at(-1)]) : s;
function rules(schema, prefix = "") {
  const out = {},
    s = resolve(schema);
  for (const [name, raw] of Object.entries(s.properties || {})) {
    const v = resolve(raw),
      key = prefix + name,
      type = v.type;
    const nonempty =
      (v.minLength || v.minItems || 0) > 0 ||
      type === "object" ||
      ["integer", "boolean", "number"].includes(type);
    const rr = [
      s.required?.includes(name)
        ? nonempty
          ? "required"
          : "present"
        : "sometimes",
    ];
    if (v.nullable) rr.push("nullable");
    if (type === "object")
      rr.push("array:" + Object.keys(v.properties || {}).join(","));
    else if (type === "array") rr.push("array");
    else if (type)
      rr.push(
        { integer: "integer", boolean: "boolean", number: "numeric" }[type] ||
          "string",
      );
    if (v.format === "email") rr.push("email:rfc", "lowercase");
    if (v.format === "date-time") rr.push("date");
    if (v.format === "date") rr.push("date_format:Y-m-d");
    if (v.format === "uri") rr.push("url:http,https");
    if (v.enum)
      rr.push(
        v.enum.length === 1 && v.enum[0] === true
          ? "accepted"
          : "in:" + v.enum.join(","),
      );
    if (v.pattern) rr.push("regex:~" + v.pattern.replaceAll("~", "\\~") + "~D");
    for (const [property, rule] of [
      ["minLength", "min"],
      ["maxLength", "max"],
      ["minimum", "min"],
      ["maximum", "max"],
      ["minItems", "min"],
      ["maxItems", "max"],
    ])
      if (property in v) rr.push(rule + ":" + v[property]);
    if (name === "password_confirmation") rr.push("same:password");
    out[key] = rr;
    if (type === "object") Object.assign(out, rules(v, key + "."));
    if (type === "array") {
      const item = resolve(v.items);
      if (item.type === "object")
        Object.assign(
          out,
          rules(
            { type: "object", properties: { "*": item }, required: ["*"] },
            key + ".",
          ),
        );
      else {
        const r = [
          { integer: "integer", boolean: "boolean", number: "numeric" }[
            item.type
          ] || "string",
        ];
        if (item.pattern)
          r.push("regex:~" + item.pattern.replaceAll("~", "\\~") + "~D");
        if (item.enum) r.push("in:" + item.enum.join(","));
        out[key + ".*"] = r;
      }
    }
  }
  return out;
}
const inputs = {};
for (const ops of Object.values(spec.paths))
  for (const op of Object.values(ops)) {
    const s = op.requestBody?.content?.["application/json"]?.schema;
    if (s?.$ref) {
      const name = s.$ref.split("/").at(-1);
      if (name !== "Webhook") inputs[name] = rules(s);
    }
  }
const expected = {
  "apps/api/resources/contract.json": JSON.stringify(spec),
  "apps/api/resources/input-rules.json": JSON.stringify(inputs),
};
const mode = process.argv[2] || "generate";
if (mode === "generate" || mode === "check") {
  for (const [path, text] of Object.entries(expected)) {
    if (mode === "generate") writeFileSync(path, text + "\n");
    else if (JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== text)
      throw new Error(`${path} is stale; run contract:generate.`);
  }
  if (mode === "check") {
    const expectedHash = readFileSync("contracts/openapi.sha256", "utf8")
      .trim()
      .split(/\s+/)[0];
    if (
      createHash("sha256")
        .update(readFileSync("contracts/openapi.yaml"))
        .digest("hex") !== expectedHash
    )
      throw new Error(
        "The frozen contract hash is stale. Qualify the change and regenerate the coverage record.",
      );
  }
  console.log(
    `Contract ${mode}: ${Object.keys(inputs).length} request schemas; ${
      Object.values(spec.paths)
        .flatMap(Object.values)
        .filter((o) => o.operationId).length
    } operations.`,
  );
} else if (mode === "examples") {
  function jsonSchema(value) {
    if (Array.isArray(value)) return value.map(jsonSchema);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const [k, v] of Object.entries(value))
      if (
        k !== "nullable" &&
        !k.startsWith("x-") &&
        !["example", "discriminator", "xml", "externalDocs"].includes(k)
      )
        out[k] = jsonSchema(v);
    if (value.nullable) return { anyOf: [out, { type: "null" }] };
    return out;
  }
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addFormat("int32", true);
  ajv.addFormat("int64", true);
  ajv.addFormat("binary", true);
  const root = { components: { schemas: jsonSchema(spec.components.schemas) } };
  let total = 0;
  function validate(name, data) {
    const v = ajv.compile({ ...root, $ref: "#/components/schemas/" + name });
    if (!v(data)) throw new Error(name + ": " + JSON.stringify(v.errors));
    total++;
  }
  for (const f of readdirSync("contracts/examples").filter((f) =>
    f.endsWith(".json"),
  ))
    validate(
      f.replace(/^\d+-/, "").replace(".json", ""),
      JSON.parse(readFileSync("contracts/examples/" + f, "utf8")),
    );
  const runtime = "apps/api/storage/framework/testing/contracts";
  if (existsSync(runtime))
    for (const f of readdirSync(runtime).filter((f) => f.endsWith(".json")))
      validate(
        f.replace(".json", ""),
        JSON.parse(readFileSync(runtime + "/" + f, "utf8")),
      );
  console.log(
    `Validated ${total} contract examples and runtime response snapshots.`,
  );
} else if (mode === "hash")
  console.log(
    createHash("sha256")
      .update(readFileSync("contracts/openapi.yaml"))
      .digest("hex"),
  );
else throw new Error("Unknown contract command");
