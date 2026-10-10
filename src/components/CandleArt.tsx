import { useId } from 'react'

export default function CandleArt({
  color,
  name,
  className = '',
}: {
  color: string
  name: string
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      className={className}
      viewBox="0 0 300 360"
      role="img"
      aria-label={`${name} candle in a glass jar`}
    >
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" x2="1">
          <stop stopColor={color} stopOpacity=".85" />
          <stop offset=".3" stopColor={color} />
          <stop offset=".65" stopColor={color} />
          <stop offset="1" stopColor="#231913" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="1">
          <stop stopColor="white" stopOpacity=".22" />
          <stop offset=".6" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-flame`}>
          <stop stopColor="#fffce3" />
          <stop offset=".55" stopColor="#ffce72" />
          <stop offset="1" stopColor="#ed8c33" />
        </radialGradient>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <ellipse
        cx="150"
        cy="318"
        rx="83"
        ry="12"
        fill="#24180c"
        opacity=".18"
        filter={`url(#${id}-blur)`}
      />
      <path
        d="M73 123 Q73 105 150 105 Q227 105 227 123 L227 291 Q227 312 150 313 Q73 312 73 291Z"
        fill={`url(#${id}-glass)`}
      />
      <ellipse cx="150" cy="122" rx="77" ry="17" fill={color} />
      <ellipse cx="150" cy="120" rx="68" ry="12" fill="#e4d5b8" />
      <ellipse
        cx="150"
        cy="120"
        rx="76"
        ry="16"
        fill="none"
        stroke="#fff"
        strokeOpacity=".25"
        strokeWidth="3"
      />
      <path
        d="M83 137L83 287Q91 299 109 299L109 137Z"
        fill={`url(#${id}-shine)`}
      />
      <rect x="91" y="175" width="118" height="86" rx="1" fill="#f8f3e9" />
      <text
        x="150"
        y="202"
        textAnchor="middle"
        fill="#3d342a"
        fontFamily="Georgia, serif"
        fontSize="18"
        letterSpacing="3"
      >
        LUMORA
      </text>
      <line
        x1="111"
        x2="189"
        y1="214"
        y2="214"
        stroke="#b4a48e"
        strokeWidth=".5"
      />
      <text
        x="150"
        y="232"
        textAnchor="middle"
        fill="#5c4d40"
        fontFamily="Arial, sans-serif"
        fontSize="9"
        letterSpacing="1"
      >
        {name.toUpperCase()}
      </text>
      <text
        x="150"
        y="248"
        textAnchor="middle"
        fill="#7c6e5d"
        fontFamily="Arial, sans-serif"
        fontSize="6"
        letterSpacing="1.2"
      >
        SCENTED CANDLE
      </text>
      <path
        d="M150 118L150 105"
        stroke="#3d3023"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="illustrated-flame"
        d="M150 106C132 94 143 75 151 59C154 78 170 94 150 106Z"
        fill={`url(#${id}-flame)`}
      />
    </svg>
  )
}
