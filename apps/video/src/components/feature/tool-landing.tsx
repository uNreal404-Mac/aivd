import "./tool-landing.css";

/**
 * A tool page that is also a landing page: the generator fills the first
 * screen, and the page scrolls on to the text under it. On wide screens the
 * tool layout fixes its main area to the window, so this scrolls inside it.
 */
export function ToolLanding({ children }: { children: React.ReactNode }) {
  return <div className="tool-landing">{children}</div>;
}
