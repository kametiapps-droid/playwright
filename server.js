const http = require("http");
const { auditUrl } = require("./audit");

const PORT = process.env.PORT || 3000;

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    return sendJson(res, 200, {
      ok: true,
      service: "BacklinkBase Playwright Audit Worker",
      status: "ready",
    });
  }

  if (req.method === "POST" && req.url === "/audit") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const url = data.url;

        if (!url || typeof url !== "string") {
          return sendJson(res, 400, {
            ok: false,
            error: "URL is required",
          });
        }

        // Call the fully upgraded module
        const result = await auditUrl(url);

        return sendJson(res, result.error ? 422 : 200, result);
      } catch (error) {
        return sendJson(res, 500, {
          ok: false,
          error: "Internal Server Error: " + error.message,
        });
      }
    });

    return;
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Not found",
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Audit worker running on port ${PORT}`);
});
