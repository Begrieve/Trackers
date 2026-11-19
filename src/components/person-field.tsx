"use client";

export type PersonOption = { id: string; name: string };

/**
 * Who a jar went to: pick someone already in the ledger, or type a name.
 *
 * A text box rather than a dropdown because the person you hand a sample to
 * is often not a customer yet — that is rather the point of a sample. A name
 * that isn't known gets added to People, the same way a new kimchi type is
 * created by typing it on the Products page.
 */
export function PersonField({
  people,
  defaultValue = "",
  id = "person",
  label = "Who got it",
  hint,
}: {
  people: PersonOption[];
  defaultValue?: string;
  id?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name="person"
        list={`${id}-options`}
        className="field"
        defaultValue={defaultValue}
        placeholder="Nobody in particular"
        autoComplete="off"
      />
      <datalist id={`${id}-options`}>
        {people.map((person) => (
          <option key={person.id} value={person.name} />
        ))}
      </datalist>
      <p className="mt-1 text-xs text-fg-subtle">
        {hint ?? "Pick someone or type a new name — a name you type is added to People."}
      </p>
    </div>
  );
}
