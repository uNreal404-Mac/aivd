import Link from "next/link";

import { formatUpdated } from "@/config/content-dates";
import type { HelpArticle } from "@/lib/help-articles";
import { localizedHref } from "@/lib/locale-path";
import "@/styles/legal-tokens.css";
import "./help.css";

const helpHref = (lang: string, slug?: string) => localizedHref(lang, slug ? `/help/${slug}` : "/help");

/** One question: the answer first, then the detail, related questions and pages. */
export function HelpArticleView({ article, related, lang }: { article: HelpArticle; related: HelpArticle[]; lang: string }) {
  const zh = lang === "zh";
  return (
    <div className="help">
      <article className="help-inner">
        <nav className="help-crumbs" aria-label={zh ? "面包屑" : "Breadcrumb"}>
          <Link href={localizedHref(lang, "/")}>{zh ? "首页" : "Home"}</Link>
          <span aria-hidden="true">/</span>
          <Link href={helpHref(lang)}>{zh ? "帮助中心" : "Help"}</Link>
        </nav>
        <h1 className="help-title">{article.question}</h1>
        <p className="help-updated">
          {zh ? "最后更新：" : "Last updated: "}
          <time dateTime={article.updated}>{formatUpdated(article.updated, zh)}</time>
        </p>
        <p className="help-answer">{article.answer}</p>

        {article.sections.map((section) => (
          <section key={section.heading} className="help-section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <aside className="help-more">
          <h2>{zh ? "相关问题" : "Related questions"}</h2>
          <ul>
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={helpHref(lang, item.slug)}>{item.question}</Link>
              </li>
            ))}
          </ul>
          <h2>{zh ? "相关页面" : "Related pages"}</h2>
          <ul>
            {article.links.map((link) => (
              <li key={link.path}>
                <Link href={localizedHref(lang, link.path)}>{link.label}</Link>
              </li>
            ))}
            <li>
              <Link href={helpHref(lang)}>{zh ? "全部问题" : "All questions"}</Link>
            </li>
          </ul>
        </aside>
      </article>
    </div>
  );
}

/** Every question with its short answer. */
export function HelpIndexView({ articles, lang, updated }: { articles: HelpArticle[]; lang: string; updated: string }) {
  const zh = lang === "zh";
  return (
    <div className="help">
      <div className="help-inner">
        <h1 className="help-title">{zh ? "帮助中心" : "Help center"}</h1>
        <p className="help-updated">
          {zh ? "最后更新：" : "Last updated: "}
          <time dateTime={updated}>{formatUpdated(updated, zh)}</time>
        </p>
        <ul className="help-list">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={helpHref(lang, article.slug)}>{article.question}</Link>
              <p>{article.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
