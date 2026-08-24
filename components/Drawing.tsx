import type { Role, ViewScene } from "@/lib/draw/scene";

/* One renderer for all three views.
 *
 * The geometry arrives already projected into the viewBox, so everything here
 * is a constant: 2 px cut lines, 1.5 px folds, 15 px labels. Nothing scales
 * with the fitting, which is what stops a 6 m run's dimension text from
 * rendering at four pixels while a collar's fills the frame.
 */

const STROKE: Record<Role, string> = {
  cut: "stroke-heading",
  fold: "stroke-accent",
  centre: "stroke-muted",
  hidden: "stroke-muted",
  "face-top": "stroke-heading",
  "face-side": "stroke-heading",
  "face-end": "stroke-heading",
};

const FILL: Record<Role, string> = {
  cut: "fill-none",
  fold: "fill-none",
  centre: "fill-none",
  hidden: "fill-none",
  "face-top": "fill-face-top",
  "face-side": "fill-face-side",
  "face-end": "fill-face-end",
};

const WIDTH: Record<Role, number> = {
  cut: 2,
  fold: 1.6,
  centre: 1,
  hidden: 1,
  "face-top": 1.2,
  "face-side": 1.2,
  "face-end": 1.2,
};

const DASH: Partial<Record<Role, string>> = {
  fold: "11 7",
  centre: "26 6 4 6",
  hidden: "6 6",
};

export default function Drawing({
  scene,
  title,
  className,
}: {
  scene: ViewScene;
  title: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      className={`h-auto w-full${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {scene.shapes.map((s, i) => (
        <path
          key={`s${i}`}
          d={s.d}
          className={`${STROKE[s.role]} ${FILL[s.role]}`}
          strokeWidth={WIDTH[s.role]}
          strokeDasharray={DASH[s.role]}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {scene.dims.map((d, i) => {
        if (d.t === "note") {
          return (
            <text
              key={`d${i}`}
              x={d.x}
              y={d.y}
              textAnchor={d.anchor}
              className="fill-accent text-[15px] font-medium tabular-nums"
            >
              {d.text}
            </text>
          );
        }
        if (d.t === "len") {
          return (
            <g key={`d${i}`}>
              <path d={d.d} className="stroke-accent fill-none" strokeWidth={1.1} />
              <path d={d.ticks} className="stroke-accent fill-none" strokeWidth={1.6} />
              <text
                x={d.x}
                y={d.y}
                textAnchor="middle"
                transform={`rotate(${d.angle} ${d.x} ${d.y})`}
                className="fill-accent text-[15px] font-medium tabular-nums"
              >
                {d.text}
              </text>
            </g>
          );
        }
        return (
          <g key={`d${i}`}>
            <path d={d.d} className="stroke-accent fill-none" strokeWidth={1.1} />
            <text
              x={d.x}
              y={d.y}
              textAnchor={d.t === "rad" ? d.anchor : "middle"}
              className="fill-accent text-[15px] font-medium tabular-nums"
            >
              {d.text}
            </text>
          </g>
        );
      })}

      {scene.captions.map((c, i) => (
        <text
          key={`c${i}`}
          x={c.x}
          y={c.y}
          textAnchor={c.anchor}
          className="fill-muted text-[13px] font-medium uppercase tracking-[0.06em]"
        >
          {c.text}
        </text>
      ))}
    </svg>
  );
}
