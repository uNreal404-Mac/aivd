import Link from "next/link";

import { CONTENT_UPDATED, formatUpdated } from "@/config/content-dates";
import type { ComparePage } from "@/lib/compare-pages";
import { localizedHref } from "@/lib/locale-path";
import { landingHref } from "@/lib/model-landing";
import "@/styles/legal-tokens.css";
import "@/components/help/help.css";
import "./compare.css";

/**
 * A model comparison, server-rendered: the answer first, then the table, when
 * to pick each, the questions (native <details>) and the links on. Laid out
 * like the help centre, whose styles it shares.
 */
export function ComparePageView({ page, lang }: { page: ComparePage; lang: string }) {
  const zh = lang === "zh";
  const href = (path: string) => localizedHref(lang, path);
  return (
    <div className="help">
      <article className="help-inner cmp-inner">
        <nav className="help-crumbs" aria-label={zh ? "面包屑" : "Breadcrumb"}>
          <Link href={href("/")}>{zh ? "首页" : "Home"}</Link>
          <span aria-hidden="true">/</span>
          <span>{zh ? "模型对比" : "Compare"}</span>
        </nav>
        <h1 className="help-title">{page.h1}</h1>
        <p className="help-updated">
          {zh ? "最后更新：" : "Last updated: "}
          <time dateTime={CONTENT_UPDATED.models}>{formatUpdated(CONTENT_UPDATED.models, zh)}</time>
        </p>
        <p className="help-answer">{page.answer}</p>

        <section className="help-section" aria-labelledby="cmp-table">
          <h2 id="cmp-table">{zh ? "参数和价格对比" : "Specs and price side by side"}</h2>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead>
                <tr>
                  {page.columns.map((column, index) => (
                    <th key={column} scope="col" className={index === 0 ? "cmp-label" : undefined}>
                      {index === 0 ? column : <Link href={href(landingHref(index === 1 ? page.a.slug : page.b.slug))}>{column}</Link>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="cmp-label">
                      {row.label}
                    </th>
                    <td>{row.a}</td>
                    <td>{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cmp-note">
            {zh
              ? "“套餐内约合”按各订阅套餐的积分单价换算，从最便宜的年付大套餐到最贵的月付入门套餐。实际积分以生成按钮上显示的为准。"
              : "“Cost on a plan” uses the credit price of each subscription, from the largest yearly plan to the smallest monthly one. The generate button shows the exact cost."}
          </p>
        </section>

        <div className="cmp-picks">
          {[
            { model: page.a, items: page.pickA },
            { model: page.b, items: page.pickB },
          ].map(({ model, items }) => (
            <section key={model.slug} className="help-section cmp-pick">
              <h2>{page.pickTitle(model.name)}</h2>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="cmp-more" href={href(landingHref(model.slug))}>
                {zh ? `${model.name} 详细介绍和价格` : `${model.name}: details and pricing`}
              </Link>
            </section>
          ))}
        </div>

        <section className="help-section" aria-labelledby="cmp-faq">
          <h2 id="cmp-faq">{zh ? "常见问题" : "Questions"}</h2>
          <div className="cmp-faq">
            {page.faqs.map((faq, index) => (
              <details key={faq.q} open={index === 0}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <aside className="help-more">
          <h2>{zh ? "相关页面" : "Related pages"}</h2>
          <ul>
            <li>
              <Link href={href(landingHref(page.a.slug))}>{page.a.name}</Link>
            </li>
            <li>
              <Link href={href(landingHref(page.b.slug))}>{page.b.name}</Link>
            </li>
            <li>
              <Link href={href("/pricing")}>{zh ? "价格" : "Pricing"}</Link>
            </li>
            <li>
              <Link href={href("/text-to-video")}>{zh ? "AI 文字生成视频" : "Text to video AI"}</Link>
            </li>
          </ul>
        </aside>
      </article>
    </div>
  );
}
