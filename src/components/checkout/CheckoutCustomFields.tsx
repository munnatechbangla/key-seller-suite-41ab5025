import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listCheckoutFieldsFn, type CheckoutField } from "@/lib/order-custom-fields.functions";

export type CheckoutFieldValues = Record<string, string>; // key = field_id
export type CheckoutFieldError = Record<string, string>;

const COUNTRIES = ["Bangladesh", "United States", "United Kingdom", "India", "Pakistan", "Canada", "Australia", "UAE", "Germany", "France", "Japan", "Singapore"];

export function useCheckoutFields(slugs: string[]) {
  const list = useServerFn(listCheckoutFieldsFn);
  const key = useMemo(() => [...slugs].sort().join(","), [slugs]);
  return useQuery({
    queryKey: ["checkout-fields", key],
    queryFn: () => list({ data: { slugs } }),
    enabled: slugs.length > 0,
    staleTime: 30_000,
  });
}

export function validateCheckoutFields(
  fields: CheckoutField[],
  values: CheckoutFieldValues,
): CheckoutFieldError {
  const errors: CheckoutFieldError = {};
  for (const f of fields) {
    const raw = (values[f.id] ?? "").toString();
    const v = raw.trim();
    if (f.is_required && !v) { errors[f.id] = `${f.label} is required`; continue; }
    if (!v) continue;
    if (f.min_length != null && v.length < f.min_length) errors[f.id] = `Minimum ${f.min_length} characters`;
    else if (f.max_length != null && v.length > f.max_length) errors[f.id] = `Maximum ${f.max_length} characters`;
    else if (f.regex_pattern) {
      try { if (!new RegExp(f.regex_pattern).test(v)) errors[f.id] = `Invalid ${f.label}`; } catch { /* ignore */ }
    }
    if (errors[f.id]) continue;
    if (f.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.id] = "Invalid email";
    else if (f.field_type === "url" && !/^https?:\/\//i.test(v)) errors[f.id] = "URL must start with http(s)://";
    else if (f.field_type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) errors[f.id] = "Must be a number";
  }
  return errors;
}

export function CheckoutCustomFields({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: CheckoutField[];
  values: CheckoutFieldValues;
  errors: CheckoutFieldError;
  onChange: (id: string, v: string) => void;
}) {
  // Initialize defaults
  useEffect(() => {
    for (const f of fields) {
      if (values[f.id] === undefined && f.default_value) onChange(f.id, f.default_value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  if (fields.length === 0) return null;

  // Group by product
  const byProduct = new Map<string, CheckoutField[]>();
  for (const f of fields) {
    const arr = byProduct.get(f.product_slug) ?? [];
    arr.push(f);
    byProduct.set(f.product_slug, arr);
  }

  return (
    <>
      {Array.from(byProduct.entries()).map(([slug, group]) => (
        <section key={slug} className="rounded-2xl bg-card border border-border p-5">
          <h3 className="font-bold text-lg mb-1">Product details</h3>
          <p className="text-xs text-muted-foreground mb-4">Required for delivery of your <span className="font-medium">{slug}</span></p>
          <div className="grid sm:grid-cols-2 gap-4">
            {group.map((f) => (
              <FieldRenderer
                key={f.id}
                field={f}
                value={values[f.id] ?? ""}
                error={errors[f.id]}
                onChange={(v) => onChange(f.id, v)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: CheckoutField;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const inputCls = `w-full px-3 py-2.5 rounded-xl bg-card border ${error ? "border-destructive" : "border-border"} outline-none focus:border-primary text-sm`;
  const wrapCls =
    field.field_type === "textarea" || field.field_type === "hidden" ? "sm:col-span-2" : "";

  if (field.field_type === "hidden") {
    return <input type="hidden" value={value ?? field.default_value ?? ""} readOnly />;
  }

  const label = (
    <label className="text-sm font-semibold block mb-1.5">
      {field.label}
      {field.is_required && <span className="text-destructive"> *</span>}
    </label>
  );

  const help = field.help_text && !error ? (
    <p className="text-[11px] text-muted-foreground mt-1">{field.help_text}</p>
  ) : null;
  const err = error ? <p className="text-[11px] text-destructive mt-1">{error}</p> : null;

  const commonProps = {
    value: value ?? "",
    onChange: (e: any) => onChange(e.target.value),
    placeholder: field.placeholder ?? undefined,
  };

  let control: React.ReactNode = null;
  switch (field.field_type) {
    case "textarea":
      control = <textarea rows={3} className={inputCls} {...commonProps} />;
      break;
    case "select":
      control = (
        <select className={inputCls} {...commonProps}>
          <option value="">{field.placeholder ?? "Select..."}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
      break;
    case "country":
      control = (
        <select className={inputCls} {...commonProps}>
          <option value="">Select country...</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      );
      break;
    case "radio":
      control = (
        <div className="space-y-1">
          {field.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`f_${field.id}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="accent-[var(--primary)]" />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    case "checkbox":
      control = (
        <label className="flex items-center gap-2 text-sm mt-1">
          <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} className="accent-[var(--primary)]" />
          {field.placeholder ?? field.label}
        </label>
      );
      break;
    case "date":
      control = <input type="date" className={inputCls} {...commonProps} />;
      break;
    case "email":
      control = <input type="email" className={inputCls} {...commonProps} />;
      break;
    case "number":
      control = <input type="number" className={inputCls} {...commonProps} />;
      break;
    case "url":
      control = <input type="url" className={inputCls} {...commonProps} />;
      break;
    case "password":
      control = <input type="password" className={inputCls} {...commonProps} />;
      break;
    case "phone":
      control = <input type="tel" className={inputCls} {...commonProps} />;
      break;
    default:
      control = <input type="text" className={inputCls} {...commonProps} />;
  }

  return (
    <div className={wrapCls}>
      {field.field_type !== "checkbox" && label}
      {control}
      {err}
      {help}
    </div>
  );
}
