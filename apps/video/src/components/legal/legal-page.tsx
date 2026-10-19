import type { CSSProperties } from "react";

import type { LegalDoc } from "@/lib/legal-content";

export type LegalPageProps = {
    doc: LegalDoc;
    locale: string;
    lastUpdated: string;
    email?: string;
};

const wrapperStyle: CSSProperties = {
    backgroundColor: "var(--lg-bg)",
    color: "var(--lg-text)",
    fontSize: "var(--lg-body-size)",
};

const containerStyle: CSSProperties = {
    maxWidth: "var(--lg-max-width)",
    margin: "0 auto",
    padding: "48px 20px 64px",
};

const titleStyle: CSSProperties = {
    color: "var(--lg-text)",
    fontSize: "var(--lg-heading-size)",
    fontWeight: 700,
    lineHeight: 1.2,
    margin: "0 0 8px",
};

const updatedStyle: CSSProperties = {
    color: "var(--lg-muted)",
    fontSize: "13px",
    margin: "0 0 24px",
};

const introStyle: CSSProperties = {
    color: "var(--lg-text)",
    lineHeight: 1.7,
    margin: "0 0 28px",
};

const sectionStyle: CSSProperties = {
    backgroundColor: "var(--lg-surface)",
    border: "1px solid var(--lg-border)",
    borderRadius: "var(--lg-radius)",
    margin: "0 0 16px",
    padding: "20px 20px 4px",
};

const sectionHeadingStyle: CSSProperties = {
    color: "var(--lg-text)",
    fontSize: "18px",
    fontWeight: 600,
    margin: "0 0 12px",
};

const paragraphStyle: CSSProperties = {
    color: "var(--lg-text)",
    lineHeight: 1.7,
    margin: "0 0 12px",
};

const listStyle: CSSProperties = {
    color: "var(--lg-text)",
    lineHeight: 1.7,
    margin: "0 0 16px",
    paddingLeft: "20px",
};

const listItemStyle: CSSProperties = {
    color: "var(--lg-text)",
    margin: "0 0 8px",
};

const linkStyle: CSSProperties = {
    color: "var(--lg-accent)",
    textDecoration: "underline",
};

/**
 * Renders a paragraph, turning the support email (when present) into a
 * mailto link. Kept as a simple split so the copy stays plain text.
 */
function Paragraph({ text, email }: { text: string; email?: string }) {
    const normalizedEmail = email?.trim();
    const index = normalizedEmail ? text.indexOf(normalizedEmail) : -1;

    if (!normalizedEmail || index === -1) {
        return <p style={paragraphStyle}>{text}</p>;
    }

    const before = text.slice(0, index);
    const after = text.slice(index + normalizedEmail.length);

    return (
        <p style={paragraphStyle}>
            {before}
            <a href={`mailto:${normalizedEmail}`} style={linkStyle}>
            {normalizedEmail}
            </a>
            {after}
        </p>
    );
}

export function LegalPage({ doc, locale, lastUpdated, email }: LegalPageProps) {
    const updatedLabel = locale === "zh" ? "最后更新" : "Last updated";

    return (
        <div style={wrapperStyle}>
            <article style={containerStyle}>
                <h1 style={titleStyle}>{doc.title}</h1>
                <p style={updatedStyle}>
                    {updatedLabel}: {lastUpdated}
                </p>
                <p style={introStyle}>{doc.intro}</p>

                {doc.sections.map((section, sectionIndex) => (
                    <section key={sectionIndex} style={sectionStyle}>
                        <h2 style={sectionHeadingStyle}>{section.heading}</h2>

                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                            <Paragraph key={paragraphIndex} text={paragraph} email={email} />
                        ))}

                        {section.bullets && section.bullets.length > 0 ? (
                            <ul style={listStyle}>
                                {section.bullets.map((bullet, bulletIndex) => (
                                    <li key={bulletIndex} style={listItemStyle}>
                                        {bullet}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </section>
                ))}
            </article>
        </div>
    );
}
