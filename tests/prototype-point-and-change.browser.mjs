import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import { previewDocument } from "/home/claude/work/picker-lib.mjs";
const proto = `<!doctype html><html><head><title>t</title></head><body><section id="pricing"><div class="card"><h3>Basic</h3><p>$10</p></div><div class="card"><h3>Pro plan</h3><button id="buy">Buy</button></div></section><script>window.clicked=0;document.getElementById('buy').onclick=function(){window.clicked++};fetch('https://example.com').then(function(){parent.postMessage({leak:1},'*')}).catch(function(){parent.postMessage({blocked:1},'*')});</script></body></html>`;
const doc = previewDocument(proto);
const host = `<!doctype html><html><body><iframe id="f" sandbox="allow-scripts allow-forms" style="width:600px;height:400px"></iframe><script>window.got=[];addEventListener('message',function(e){if(e.source===document.getElementById('f').contentWindow)window.got.push(e.data)});document.getElementById("f").srcdoc=${JSON.stringify(doc).replace(/<\//g, "<\\/")};</script></body></html>`;
const R = []; const t = (n, ok, info) => R.push([n, !!ok, info]);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-first-run", "--disable-background-networking", "--disable-component-update"] });
const page = await b.newPage();
await page.setContent(host); await page.waitForTimeout(1200);
const frame = await (await page.$("#f")).contentFrame();
await frame.waitForSelector("#buy", { timeout: 5000 });
// 1. dormant: a click does its normal job and reports nothing
await frame.click("#buy"); await page.waitForTimeout(200);
let got = await page.evaluate(() => window.got);
t("dormant: no pick message", !got.some((g) => g && "efyPicked" in g), got);
t("dormant: page's own click handler runs", (await frame.evaluate(() => window.clicked)) === 1);
t("network still blocked by CSP", got.some((g) => g && g.blocked) && !got.some((g) => g && g.leak), got);
// 2. pick mode
await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ efyPick: true }, "*"));
await page.waitForTimeout(150);
await frame.hover(".card:nth-of-type(2) h3"); await page.waitForTimeout(100);
t("hover outline shown", await frame.evaluate(() => !!document.querySelector("[data-efy-pick]")));
await frame.click(".card:nth-of-type(2) h3"); await page.waitForTimeout(200);
got = await page.evaluate(() => window.got);
const pk = got.find((g) => g && g.efyPicked);
t("pick reports element", pk && pk.efyPicked.html.includes("Pro plan"), pk);
t("pick path is specific", pk && /section#pricing > div\.card:nth-of-type\(2\) > h3/.test(pk.efyPicked.path), pk && pk.efyPicked.path);
t("pick label is the text", pk && pk.efyPicked.label === "Pro plan", pk && pk.efyPicked.label);
t("pick mode ends after one click", await frame.evaluate(() => !document.querySelector("[data-efy-pick]")));
// 3. clicking a button in pick mode doesn't trigger it
await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ efyPick: true }, "*"));
await page.waitForTimeout(100);
await frame.click("#buy"); await page.waitForTimeout(150);
t("pick click doesn't fire the page's handler", (await frame.evaluate(() => window.clicked)) === 1);
// 4. escape cancels
await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ efyPick: true }, "*"));
await page.waitForTimeout(100); await frame.focus("body").catch(()=>{}); await page.keyboard.press("Escape"); await page.waitForTimeout(150);
got = await page.evaluate(() => window.got);
t("escape reports cancel", got.some((g) => g && "efyPicked" in g && g.efyPicked === null), got.slice(-2));
await b.close();
for (const [n, ok, info] of R) console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(info));
console.log(`${R.filter((r) => r[1]).length}/${R.length} passed`);
