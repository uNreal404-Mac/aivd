import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type StateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  primary?: boolean;
};

/**
 * The one card used for "nothing here yet" and "something went wrong": a
 * picture or icon, a title, a line of help and what to do next.
 */
export function StateBlock({
  tone = "empty",
  icon: Icon,
  art,
  code,
  title,
  body,
  detail,
  actions = [],
  framed = false,
  children,
  className = "",
}: {
  tone?: "empty" | "error";
  icon?: LucideIcon;
  /** Up to three images fanned out above the title. */
  art?: string[];
  /** Large status code, e.g. 404. */
  code?: string;
  title: string;
  body?: ReactNode;
  /** Small technical line, e.g. an error reference. */
  detail?: string;
  actions?: StateAction[];
  framed?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`st ${tone === "error" ? "st-error" : ""} ${framed ? "st-framed" : ""} ${className}`} role={tone === "error" ? "alert" : undefined}>
      {art?.length ? (
        <div className="st-art" aria-hidden="true">
          {art.slice(0, 3).map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </div>
      ) : Icon ? (
        <span className="st-icon" aria-hidden="true">
          <Icon />
        </span>
      ) : null}
      {code ? <p className="st-code">{code}</p> : null}
      <h2 className="st-title">{title}</h2>
      {body ? <p className="st-body">{body}</p> : null}
      {detail ? <p className="st-detail">{detail}</p> : null}
      {actions.length ? (
        <div className="st-actions">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            const className = action.primary ? "st-btn st-btn-primary" : "st-btn";
            return action.href ? (
              <Link key={action.label} href={action.href} className={className}>
                {ActionIcon ? <ActionIcon aria-hidden="true" /> : null}
                {action.label}
              </Link>
            ) : (
              <button key={action.label} type="button" className={className} onClick={action.onClick}>
                {ActionIcon ? <ActionIcon aria-hidden="true" /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {children}
    </div>
  );
}
