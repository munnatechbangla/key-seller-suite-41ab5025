import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
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

/**
 * Renders enabled custom fields for a single product, persisting values into
 * the cart store keyed by product slug. Values survive variant switches and
 * flow through cart → checkout → order automatically.
 */
export const ProductCustomFields = forwardRef<ProductCustomFieldsHandle, { productSlug: string }>(
  function ProductCustomFields({ productSlug }, ref) {
    const q = useCheckoutFields([productSlug]);
    const fields = q.data ?? [];
    const stored = useCart((s) => s.productFieldValues[productSlug] ?? {});
    const setProductField = useCart((s) => s.setProductField);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Seed defaults into the store the first time we see the fields.
    useEffect(() => {
      for (const f of fields) {
        if (stored[f.id] === undefined && f.default_value) {
          setProductField(productSlug, f.id, f.default_value);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields.length]);

    useImperativeHandle(ref, () => ({
      validate: () => {
        const errs = validateCheckoutFields(fields, stored as CheckoutFieldValues);
        setErrors(errs);
        return Object.keys(errs).length === 0;
      },
    }), [fields, stored]);

    if (q.isLoading || fields.length === 0) return null;

    return (
      <CheckoutCustomFields
        fields={fields}
        values={stored as CheckoutFieldValues}
        errors={errors}
        onChange={(id, v) => {
          setProductField(productSlug, id, v);
          if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
        }}
      />
    );
  }
);
