export type LineagePoint = {
  id: string
  x: number
  y: number
}

type LineagePathProps = {
  points: LineagePoint[]
}

export const LineagePath = ({ points }: LineagePathProps) => {
  if (points.length < 2) return null

  const d = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <g className="hud-lineage">
      <path className="hud-lineage-glow" d={d} fill="none" />
      <path className="hud-lineage-line" d={d} fill="none" />
      {points.map((point, index) => (
        <circle
          key={point.id}
          className={index === points.length - 1 ? 'hud-lineage-node is-active' : 'hud-lineage-node'}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 5 : 4}
        />
      ))}
    </g>
  )
}
