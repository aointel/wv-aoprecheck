const https = require("https");
const fs = require("fs");

const config = JSON.parse(
  fs.readFileSync("C:/Users/mmand/.railway/config.json", "utf8"),
);
const token = config?.user?.accessToken;
if (!token) {
  console.error("Missing Railway access token.");
  process.exit(1);
}

const body = JSON.stringify({
  query:
    'query { project(id: "20b8d382-8b91-417b-98bb-c113ae727d49") { services { edges { node { id name } } } } }',
});

const req = https.request(
  {
    hostname: "backboard.railway.app",
    path: "/graphql/v2",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      console.log(data);
    });
  },
);

req.on("error", (err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});

req.write(body);
req.end();
