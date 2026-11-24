// Empty image studio: a fanned stack of our own sample pictures over the
// model's name, until the first result arrives.
const STACK = [
  { src: "/home/samples/red-carpet.webp", className: "is-card is-card-1" },
  { src: "/home/samples/rain-couple.webp", className: "is-card is-card-2" },
  { src: "/home/samples/dancer.webp", className: "is-card is-card-3" },
  { src: "/home/samples/autumn-walk.webp", className: "is-card is-card-4" },
];

export function StudioHero({ zh, modelName }: { zh: boolean; modelName: string }) {
  return (
    <section className="is-hero">
      <div className="is-stack" aria-hidden="true">
        {STACK.map((item) => (
          <span key={item.src} className={item.className}>
            <img src={item.src} alt="" />
          </span>
        ))}
      </div>
      <h1 className="is-title">
        <span>{zh ? "用" : "Create with"}</span>
        <span className="is-title-model">{modelName}</span>
        <span>{zh ? "把想法变成画面" : "from a few words"}</span>
      </h1>
      <p className="is-sub">
        {zh ? "写下人物、场景、光线和风格，剩下的交给模型" : "Name the subject, the setting, the light and the style. The model does the rest."}
      </p>
    </section>
  );
}
