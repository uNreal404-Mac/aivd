"""Run with an existing Python Playwright installation: python3 scripts/verify-motion.py URL OUTPUT_DIRECTORY."""
import argparse
import json
import traceback
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

args = argparse.ArgumentParser(description=__doc__)
args.add_argument("url")
args.add_argument("output", type=Path)
options = args.parse_args()
options.output.mkdir(parents=True, exist_ok=True)
report = {}
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    for device, width, reduced in (("desktop", 1440, False), ("mobile", 390, False), ("reduced", 1440, True)):
        context = browser.new_context(viewport={"width": width, "height": 844},
                                      is_mobile=device == "mobile", has_touch=device == "mobile",
                                      reduced_motion="reduce" if reduced else "no-preference")
        page = context.new_page()
        page.set_default_timeout(16000)
        errors, movies = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: movies.append(r.url) if ".mp4" in r.url else None)
        result = report[device] = {}
        try:
            page.goto(options.url, wait_until="domcontentloaded", timeout=65000)
            h1 = page.locator("#creator-headline")
            expect(h1).to_be_visible()
            expect(page.locator(".motion-card")).to_have_count(3)
            assert float(h1.evaluate("e=>getComputedStyle(e).opacity")) >= .85
            page.locator("#conversion-hero textarea").focus()
            result["prompt_glow"] = page.locator(".du-prompt-box").evaluate("e=>getComputedStyle(e).boxShadow")
            assert result["prompt_glow"] != "none"
            page.screenshot(path=str(options.output/(device+"-hero.png")),animations="allow")
            wall = page.locator("#template-wall")
            wall.scroll_into_view_if_needed()
            page.mouse.move(0,0)
            page.locator("#conversion-hero textarea").evaluate("e=>e.blur()")
            lanes = wall.locator("[data-motion-lane]")
            result["viewport_width"] = page.evaluate("document.documentElement.scrollWidth")
            assert result["viewport_width"] == width
            first = wall.locator('[data-copy="0"] .motion-tile').first
            if device == "desktop":
                page.wait_for_timeout(250)
                x = lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                page.wait_for_timeout(480)
                y = lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                assert y[0] > x[0] and y[1] < x[1], (x,y)
                result["opposing_scroll"] = [x,y]
                toggle = page.locator(".motion-marquee-toggle")
                toggle.click()
                page.wait_for_timeout(80)
                x = lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                page.wait_for_timeout(350)
                assert x == lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                first.hover()
                expect(first.locator("video")).to_have_count(1)
                expect(wall.locator("video")).to_have_count(1)
                page.wait_for_function("document.querySelector('#template-wall video')?.currentTime>0")
                assert first.locator("video").evaluate("v=>v.muted&&v.loop&&v.playsInline&&v.preload==='none'")
                page.mouse.move(0,0)
                expect(wall.locator("video")).to_have_count(0)
                page.locator('[aria-controls="template-wall"]').last.focus(); page.keyboard.press("Tab")
                expect(wall.locator("video")).to_have_count(1)
                page.locator("#models").scroll_into_view_if_needed()
                expect(wall.locator("video")).to_have_count(0)
                card = page.locator(".motion-card").first
                card.hover()
                assert card.evaluate("e=>e.style.getPropertyValue('--spot-x')") != ""
                result["keyboard_and_visibility"] = True
            elif device == "mobile":
                visible=wall.locator("a:visible")
                assert visible.count()==6
                assert len(set(visible.evaluate_all("els=>els.map(e=>Math.round(e.getBoundingClientRect().top))")))==1
                assert not movies, movies
                result["initial_mp4"] = list(movies)
                button = first.locator(".motion-touch-preview")
                button.click()
                expect(first.locator("video")).to_have_count(1)
                expect(wall.locator("video")).to_have_count(1)
                button.click()
                expect(wall.locator("video")).to_have_count(0)
                assert first.locator("a").get_attribute("href")
                result["explicit_preview"] = True
            else:
                x = lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                page.wait_for_timeout(450)
                assert x == lanes.evaluate_all("els=>els.map(e=>e.scrollLeft)")
                first.hover()
                expect(wall.locator("video")).to_have_count(0)
                assert not movies, movies
                result["static"] = True
            assert len(errors)==0, errors
            if device == "desktop":
                page.goto(options.url.rstrip("/")+"/pricing",wait_until="domcontentloaded")
                page.wait_for_load_state("networkidle",timeout=12000)
                toggle=page.locator(".pr-toggle")
                expect(toggle.locator("button")).to_have_count(2)
                expect(page.locator(".motion-recommended")).to_have_count(1)
                before=page.locator(".pr-card .pr-price").first.inner_text()
                toggle.locator("button").last.click()
                expect(toggle.locator("button").last).to_have_attribute("aria-pressed","true")
                page.wait_for_timeout(420)
                after=page.locator(".pr-card .pr-price").first.inner_text()
                result["billing_prices"]=[before,after]
                assert before!=after, (before,after)
                result["billing"]=[before,after,toggle.locator("i").evaluate("e=>getComputedStyle(e).transform")]
            result["pass"]=True
        except Exception as exc:
            result.update({"pass":False,"error":traceback.format_exc(),"pageerrors":errors})
        finally:
            (options.output/"motion.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
            print(device,json.dumps(result,ensure_ascii=False),flush=True)
            context.close()
    browser.close()
if not all(entry["pass"] for entry in report.values()): raise SystemExit(1)
