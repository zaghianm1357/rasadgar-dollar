#!/usr/bin/env node
/**
 * تست E2E دماسنج نسخه مستقل — بدون اینترنت خارجی
 *  ۱) کپی موقت از فایل build شده که PROXIES به سرور محلی همین اسکریپت اشاره می‌کند
 *  ۲) سرور: /app.html (فایل تست) + /mock (کندل مصنوعی Yahoo با CORS) + /spot (gold-api ساختگی)
 *  فایل اصلی download/rasadgar-dollar.html دست‌نخورده می‌ماند.
 */
const http = require("http");
const fs = require("fs");

const BASE = "/home/z/my-project";
let html = fs.readFileSync(`${BASE}/download/rasadgar-dollar.html`, "utf8");

/* جایگزینی پروکسی‌ها با اندپوینت محلی */
const before = html.length;
html = html.replace(
  /var PROXIES = \[[\s\S]*?\];/,
  "var PROXIES = [function (u) { return 'http://127.0.0.1:8899/mock?u=' + encodeURIComponent(u); }];"
);
if (html.length === before) { console.error("PROXIES replace failed"); process.exit(1); }

/* جایگزینی gold-api با اندپوینت محلی */
html = html.split("https://api.gold-api.com/price/").join("http://127.0.0.1:8899/spot/");

const mock = fs.readFileSync(`${BASE}/scripts/pt-mock.json`, "utf8");

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = req.url || "";
  if (url.startsWith("/spot/")) {
    const sym = url.includes("XAG") ? 48.5 : 4123.7;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ price: sym }));
    return;
  }
  if (url.startsWith("/mock")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(mock);
    return;
  }
  if (url.startsWith("/app.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end("nf");
});

server.listen(8899, () => console.log("test server on :8899 — /app.html /mock /spot"));
