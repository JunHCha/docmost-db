import { pickOptionColor } from "./option-colors";

// A select / multi_select option as stored in `database_properties.config`
// (conventions §2). `id` is the stable identifier referenced by stored values.
export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

// config is full-replace on the server (see issue #8 trap): every option mutation
// below returns the WHOLE options array with existing ids preserved, so callers
// can echo it straight into updateProperty without dropping ids of options the
// row values still point at.

export function getOptions(
  config: Record<string, unknown> | undefined,
): SelectOption[] {
  const options = config?.options;
  return Array.isArray(options) ? (options as SelectOption[]) : [];
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function appendOption(
  options: SelectOption[],
  label: string,
  color?: string,
): { options: SelectOption[]; newOptionId: string } {
  const newOptionId = newId();
  const option: SelectOption = {
    id: newOptionId,
    label,
    color: color ?? pickOptionColor(options.length),
  };
  return { options: [...options, option], newOptionId };
}

export function renameOption(
  options: SelectOption[],
  id: string,
  label: string,
): SelectOption[] {
  return options.map((o) => (o.id === id ? { ...o, label } : o));
}

export function recolorOption(
  options: SelectOption[],
  id: string,
  color: string,
): SelectOption[] {
  return options.map((o) => (o.id === id ? { ...o, color } : o));
}

export function removeOption(
  options: SelectOption[],
  id: string,
): SelectOption[] {
  return options.filter((o) => o.id !== id);
}
