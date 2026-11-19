import { bodyFields, type BodyProfile } from "@/lib/body-profile";

export function BodyFields({ prefix, values }: {
  prefix: string;
  values?: Pick<BodyProfile, "heightCm" | "weightKg" | "bodyFatRate">;
}) {
  return (
    <div className="body-fields">
      {bodyFields.map(({ name, label, min, max, required, example }) => (
        <div className="field" key={name}>
          <label htmlFor={`${prefix}-${name}`}>{label}</label>
          <input id={`${prefix}-${name}`} name={name} type="number" inputMode="decimal"
            min={min} max={max} step="any" required={required} placeholder={example}
            defaultValue={values?.[name] ?? ""} />
        </div>
      ))}
    </div>
  );
}
