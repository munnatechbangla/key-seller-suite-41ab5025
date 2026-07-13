import { Component, forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";
import { useCart } from "@/lib/stores";
import {
  CheckoutCustomFields,
  useCheckoutFields,
  validateCheckoutFields,
  type CheckoutFieldValues,
} from "@/components/checkout/CheckoutCustomFields";

export type ProductCustomFieldsHandle = {
  validate: () => boolean;
};

/** Isolate any render/runtime error so the product page stays alive. */
class SilentBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("[ProductCustomFields] suppressed:", err); }
  render() { return this.state.hasError ? null : this.props.children; }
}

const Inner = forwardRef<ProductCustomFieldsHandle, { productSlug: string }>(
  function Inner({ productSlug }, ref) {
    const slug = (productSlug ?? "").trim();
    const q = useCheckoutFields(slug ? [slug] : []);
    const fields = Array.isArray(q.data) ? q.data : [];
    const stored = useCart((s) => (s.productFieldValues ?? {})[slug] ?? {});
    const setProductField = useCart((s) => s.setProductField);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
      if (!slug || fields.length === 0) return;
      for (const f of fields) {
        if (stored[f.id] === undefined && f.default_value) {
          setProductField(slug, f.id, f.default_value);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields.length, slug]);

    useImperativeHandle(ref, () => ({
      validate: () => {
        if (fields.length === 0) return true;
        const errs = validateCheckoutFields(fields, stored as CheckoutFieldValues);
        setErrors(errs);
        return Object.keys(errs).length === 0;
      },
    }), [fields, stored]);

    if (!slug || q.isLoading || fields.length === 0) return null;

    return (
      <CheckoutCustomFields
        fields={fields}
        values={stored as CheckoutFieldValues}
        errors={errors}
        onChange={(id, v) => {
          setProductField(slug, id, v);
          if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
        }}
      />
    );
  }
);

export const ProductCustomFields = forwardRef<ProductCustomFieldsHandle, { productSlug: string }>(
  function ProductCustomFields(props, ref) {
    return (
      <SilentBoundary>
        <Inner {...props} ref={ref} />
      </SilentBoundary>
    );
  }
);
