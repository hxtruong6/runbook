import { Badge } from '@mantine/core'

export const METHOD_COLORS: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'amber',
  PATCH: 'amber',
  DELETE: 'red',
  HEAD: 'gray',
  OPTIONS: 'gray',
}

type Props = {
  method: string
  size?: 'xs' | 'sm' | 'md'
}

export function MethodBadge({ method, size = 'xs' }: Props) {
  const upper = method.toUpperCase()
  return (
    <Badge size={size} color={METHOD_COLORS[upper] ?? 'gray'} variant="light" style={{ flexShrink: 0 }}>
      {upper}
    </Badge>
  )
}
