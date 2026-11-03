// Copied to a temporary Playwright test directory by ui-shots.cjs.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const bin = process.env.PATH.split(path.delimiter).map(dir => path.join(dir,process.platform==="win32"?"playwright.cmd":"playwright")).find(p => fs.existsSync(p) && path.basename(path.dirname(p))===".bin");
if (!bin) throw Error("Run through npm run shots (npx playwright).");
const requireTool = createRequire(path.join(path.dirname(path.dirname(bin)),"playwright","package.json"));
const { test, expect } = requireTool("playwright/test");
const job = JSON.parse(fs.readFileSync(path.join(__dirname,"jobs.json"),"utf8"));
const slugs = { home:"", pricing:"/pricing", generator:"/text-to-video" };
for (const name of job.pages) for (const width of [375,390,1440]) {
  const height=width===1440?900:width===390?844:812;
  test(name+" "+width, async ({browser}) => {
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,locale:job.lang==="zh"?"zh-CN":"en-US",reducedMotion:"reduce"});
    try {
      const page=await ctx.newPage();
      const scriptErrors=[];
      page.on("pageerror",e=>scriptErrors.push(e.message));
      const pathname=(job.lang==="zh"?"/zh":"")+slugs[name] || "/";
      const res=await page.goto(job.base+pathname,{waitUntil:"domcontentloaded",timeout:60000});
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(new URL(page.url()).pathname.replace(/\/$/,"")).toBe(pathname.replace(/\/$/,""));
      await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})));});
      const key=name+"-"+width;
      await page.screenshot({path:path.join(job.out,key+"-fold.png"),animations:"disabled",caret:"hide"});
      await page.evaluate(async()=>{
        for(let y=0; y<document.documentElement.scrollHeight && y<40000; y+=Math.max(240,innerHeight*.8)){
          scrollTo({top:y,behavior:"instant"}); await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
        }
        await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(done=>setTimeout(done,5000))]);
        scrollTo({top:0,behavior:"instant"}); await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      });
      await page.screenshot({path:path.join(job.out,key+"-full.png"),fullPage:true,animations:"disabled",caret:"hide"});
      const facts=await page.evaluate(()=>({title:document.title,h1:document.querySelector("h1")?.innerText,lang:document.documentElement.lang,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,failedImages:[...document.images].filter(i=>i.getClientRects().length && i.complete && !i.naturalWidth).map(i=>i.getAttribute("src")?.split("?")[0])}));
      fs.writeFileSync(path.join(job.out,key+".json"), JSON.stringify({name,pathname,width,height,scriptErrors,...facts},null,2));
      expect(facts.scrollWidth, "document-level horizontal overflow").toBeLessThanOrEqual(width+1);
    } finally { await ctx.close(); }
  });
}
