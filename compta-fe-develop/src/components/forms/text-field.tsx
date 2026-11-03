export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "date";
  required?: boolean;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-xs font-medium text-[#405069]">
        {label}
        {required ? <span className="text-[#8e2a26]"> *</span> : null}
      </span>
      <input
        id={id}
        className={`h-10 w-full rounded-[12px] border bg-white px-3 text-sm text-[#063586] outline-none focus:ring-[3px] focus:ring-[#044ce2]/35 ${
          error ? "border-[#c9564f]" : "border-[#dfe6f1] hover:border-[#b9d0fb]"
        }`}
        type={type}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span id={`${id}-error`} className="mt-1.5 block text-xs text-[#8e2a26]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
