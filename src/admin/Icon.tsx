const paths: Record<string, string> = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  orders: 'M5 6h14v15H5z M9 6V4a3 3 0 0 1 6 0v2',
  products: 'm12 3 9 5-9 5-9-5 9-5z M3 8v9l9 5 9-5V8 M12 13v9',
  inventory: 'M4 8h16v13H4z M3 3h18v5H3z M9 12h6',
  enquiries: 'M3 4h18v13H8l-5 4V4z M7 8h10 M7 12h6',
  content: 'M3 4h18v16H3z M3 9h18 M8 9v11',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',
  search: 'm21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  plus: 'M12 5v14 M5 12h14',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  calendar: 'M3 5h18v16H3z M7 2v6 M17 2v6 M3 11h18',
  trend: 'm3 17 6-6 4 4 8-10 M15 5h6v6',
  profile: 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
}
export default function Icon({ name }: { name: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  )
}
