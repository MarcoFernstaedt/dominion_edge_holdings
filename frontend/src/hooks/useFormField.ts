import { type Dispatch, type SetStateAction } from 'react';

type FormEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

/**
 * Returns a stable field-change handler factory for controlled form state.
 *
 * Usage:
 *   const f = useFormField(setForm);
 *   <Input onChange={f('name')} />
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormField<T extends Record<string, any>>(
  setForm: Dispatch<SetStateAction<T>>,
) {
  return (field: keyof T) => (e: FormEvent) =>
    // Cast is safe: the caller controls the form state shape and field key
    setForm((prev) => ({ ...prev, [field]: e.target.value }) as T);
}

/**
 * Same as useFormField but for checkbox inputs (uses e.target.checked).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCheckboxField<T extends Record<string, any>>(
  setForm: Dispatch<SetStateAction<T>>,
) {
  return (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }) as T);
}
