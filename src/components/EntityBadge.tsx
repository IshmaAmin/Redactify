interface Props {
  entityType: string
}

const TYPE_COLORS: Record<string, string> = {
  PERSON: 'bg-blue-100 text-blue-800',
  LOCATION: 'bg-green-100 text-green-800',
  ORGANIZATION: 'bg-purple-100 text-purple-800',
  EMAIL: 'bg-yellow-100 text-yellow-800',
  TEXT: 'bg-orange-100 text-orange-800',
  DATE: 'bg-teal-100 text-teal-800',
  NUMBER: 'bg-indigo-100 text-indigo-800',
  IBAN: 'bg-red-100 text-red-800',
  CREDIT_CARD: 'bg-red-100 text-red-800',
  SSN: 'bg-red-100 text-red-800',
  AHV: 'bg-red-100 text-red-800',
  PASSPORT: 'bg-pink-100 text-pink-800',
  DATE_OF_BIRTH: 'bg-teal-100 text-teal-800',
  IP_ADDRESS: 'bg-gray-100 text-gray-800',
  MISC: 'bg-gray-100 text-gray-800',
}

export function EntityBadge({ entityType }: Props) {
  const classes = TYPE_COLORS[entityType] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {entityType}
    </span>
  )
}
