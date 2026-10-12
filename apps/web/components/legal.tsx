import { isPlaceholder } from '@/lib/site-config';

// Renders a legal/contact value. Unset values keep the yellow [SET: ...]
// highlight so they are visibly unfinished; filled values render as plain text.
export function Fill({ value }: { value: string }) {
  if (isPlaceholder(value)) {
    return <mark className="bg-yellow-100 text-yellow-900 px-1 rounded">{value}</mark>;
  }
  return <>{value}</>;
}
