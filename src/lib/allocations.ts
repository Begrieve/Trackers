/**
 * Ways a jar leaves a batch without being sold. Plain module, not a server
 * action file, so pages and forms can import the labels.
 */

export type AllocationKindValue = "DONATED" | "KEPT" | "SHIPPED" | "WASTED";

export const ALLOCATION_KINDS: { value: AllocationKindValue; label: string; hint: string }[] = [
  { value: "KEPT", label: "Kept for us", hint: "Held back for the household" },
  { value: "DONATED", label: "Given away", hint: "A gift, a sample, a donation" },
  { value: "SHIPPED", label: "Shipped", hint: "Sent somewhere whole, outside an order" },
  { value: "WASTED", label: "Lost", hint: "Spoiled, broken, or didn't turn out" },
];

export const ALLOCATION_LABEL: Record<AllocationKindValue, string> = Object.fromEntries(
  ALLOCATION_KINDS.map((k) => [k.value, k.label]),
) as Record<AllocationKindValue, string>;

export function isAllocationKind(value: string): value is AllocationKindValue {
  return ALLOCATION_KINDS.some((k) => k.value === value);
}
