import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useCart, useAuth } from "@/lib/stores";
import { useState, useEffect } from "react";
import { Lock, Tag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { placeOrderAuthFn, placeOrderGuestFn } from "@/lib/orders.functions";
import { validateCouponFn } from "@/lib/coupons.functions";
import { couponReason } from "@/routes/cart";
import { listEnabledGatewaysFn } from "@/lib/payments/gateways.functions";
import { seoMeta } from "@/lib/cms/seo";
import { track } from "@/lib/analytics/track";
import { useCheckoutFields } from "@/components/checkout/CheckoutCustomFields";
import { saveOrderCustomFieldsAuthFn, saveOrderCustomFieldsGuestFn } from "@/lib/order-custom-fields.functions";
import { resolveLineImage } from "@/lib/cart-image";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: seoMeta({ title: "Checkout" }) }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cart = useCart();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const listGateways = useServerFn(listEnabledGatewaysFn);
  const gwQuery = useQuery({ queryKey: ["enabled-gateways"], queryFn: () => listGateways() });
  const gateways = gwQuery.data?.gateways ?? [];
  const [gateway, setGateway] = useState<string>("");
  useEffect(() => { if (!gateway && gateways[0]) setGateway(gateways[0].slug); }, [gateways, gateway]);

  const [agree, setAgree] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const placeGuest = useServerFn(placeOrderGuestFn);
  const placeAuth = useServerFn(placeOrderAuthFn);
  const validate = useServerFn(validateCouponFn);
  const saveFieldsAuth = useServerFn(saveOrderCustomFieldsAuthFn);
  const saveFieldsGuest = useServerFn(saveOrderCustomFieldsGuestFn);

  const cartSlugs = cart.items.map((i) => i.productSlug ?? i.slug);
  const fieldsQuery = useCheckoutFields(cartSlugs);
  const customFields = fieldsQuery.data ?? [];
  const storedFieldValues = useCart((s) => s.productFieldValues ?? {});


  const applyCoupon = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const r = await validate({
        data: { code: code.trim(), subtotal: cart.subtotal(), productSlugs: cart.items.map((i) => i.slug) },
      });
      if (r.ok) { cart.setCoupon(r.code, r.discount); toast.success(`Saved $${r.discount.toFixed(2)}`); setCode(""); }
      else { cart.clearCoupon(); toast.error(couponReason(r.reason, r)); }
    } finally { setApplying(false); }
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p>Your cart is empty.</p>
          <Link to="/products" className="text-primary underline">Continue shopping</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree || !privacy) { toast.error("Please accept the terms"); return; }
    if (!gateway) { toast.error("Select a payment method"); return; }
    if (submitting) return;

    // Custom field values were captured & validated on the product page.


    setSubmitting(true);
    track("begin_checkout", {
      currency: "USD",
      value: cart.total(),
      coupon: cart.coupon ?? undefined,
      items: cart.items.map((i) => ({ item_id: i.slug, item_name: i.product.name, price: i.product.price, quantity: i.qty })),
    });
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const customer = {
      email: String(fd.get("email") ?? ""),
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? ""),
      address: String(fd.get("address") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    const payload = {
      data: {
        items: cart.items.map((i) => ({
          slug: i.productSlug ?? i.slug,
          qty: i.qty,
          variant_id: i.variant?.variant_id ?? null,
          selected_attributes: i.variant?.selected_attributes ?? undefined,
        })),
        customer,
        paymentMethod: gateway,
        couponCode: cart.coupon,
      },
    };
    try {
      const result = user ? await placeAuth(payload) : await placeGuest(payload);

      // Persist custom field values (best-effort; server re-validates)
      if (customFields.length > 0) {
        const values = customFields
          .map((f) => ({ field_id: f.id, value: storedFieldValues[f.product_slug]?.[f.id] ?? "" }));
        try {
          const saveArgs = { data: { orderId: result.orderId, email: customer.email, values } };
          if (user) await saveFieldsAuth(saveArgs);
          else await saveFieldsGuest(saveArgs);
        } catch (err) {
          console.error("[custom-fields] save failed", err);
          toast.error(err instanceof Error ? err.message : "Could not save product details");
          setSubmitting(false);
          return;
        }
      }

      cart.clear();
      navigate({ to: "/pay/$orderNumber", params: { orderNumber: result.orderNumber } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Secure checkout" crumbs={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
      <form onSubmit={submit} className="container mx-auto px-4 py-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_400px] gap-8">
        <div className="min-w-0 space-y-6">
          {!user && (
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span>Already a customer?</span>
              <Link to="/auth/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </div>
          )}

          <Section title="Billing details">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" required />
              <Field name="email" label="Email" type="email" required defaultValue={user?.email} />
              <Field name="phone" label="Phone" type="tel" required />
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold block mb-1.5">Country</label>
                <select name="country" className="w-full px-3 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary">
                  {["Bangladesh", "United States", "United Kingdom", "India", "Pakistan", "Canada", "Australia", "UAE"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <Field name="address" label="Address (optional)" className="sm:col-span-2" />
            </div>
          </Section>






          <Section title="Order notes (optional)">
            <textarea name="notes" rows={3} placeholder="Anything we should know?" className="w-full px-3 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
          </Section>

          <Section title="Payment method">
            {gwQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading payment methods…</p>
            ) : gateways.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment methods enabled. Please contact support.</p>
            ) : (
              <div className="space-y-2">
                {gateways.map((g) => (
                  <label key={g.slug} className={`flex min-w-0 items-center gap-3 p-4 rounded-xl border cursor-pointer transition-smooth ${gateway === g.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <input type="radio" name="gateway" checked={gateway === g.slug} onChange={() => setGateway(g.slug)} className="shrink-0 accent-[var(--primary)]" />
                    <GatewayLogo src={g.logo_url} alt={g.name} />)
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm flex min-w-0 flex-wrap items-center gap-2">
                        {g.name}
                        {g.type === "manual" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">MANUAL</span>}
                      </div>
                      {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Section>


          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[var(--primary)]" />
              <span>I agree to the <Link to="/terms" className="text-primary underline">Terms & Conditions</Link></span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 accent-[var(--primary)]" />
              <span>I have read the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link></span>
            </label>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <h3 className="font-bold text-lg">Your order</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {cart.items.map((it) => {
                const img = resolveLineImage(it.product, it.variant);
                return (
                <div key={it.slug} className="flex items-center gap-3 text-sm">
                  {img ? (
                    <img src={img} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                  ) : (
                    <span className="text-2xl">{it.product.emoji}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.product.name}</div>
                    {it.variant && (
                      <div className="text-xs text-muted-foreground truncate">
                        {it.variant.variant_name}{it.variant.sku ? ` · ${it.variant.sku}` : ""}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">Qty {it.qty}</div>
                  </div>
                  <span className="font-semibold">
                    ${(((it.variant ? (it.variant.sale_price != null && it.variant.sale_price > 0 ? it.variant.sale_price : it.variant.price) : it.product.price)) * it.qty).toFixed(2)}
                  </span>
                </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-border space-y-1.5 text-sm">
              <Row label="Subtotal" value={`$${cart.subtotal().toFixed(2)}`} />
              {cart.coupon && <Row label={`Coupon (${cart.coupon})`} value={`-$${cart.discount().toFixed(2)}`} />}
              <Row label="Delivery" value="Free" />
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
              <span>Total</span><span className="text-primary">${cart.total().toFixed(2)}</span>
            </div>
            <div className="flex min-w-0 gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon" className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm outline-none" />
              <button type="button" onClick={applyCoupon} disabled={applying} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-60">
                <Tag className="h-4 w-4" /> {applying ? "..." : "Apply"}
              </button>
            </div>
            <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 disabled:opacity-60">
              <Lock className="h-4 w-4" /> {submitting ? "Placing order…" : "Place secure order"}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">256-bit SSL encryption. Your data is safe.</p>
          </div>
        </aside>
      </form>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-5">
      <h3 className="font-bold text-lg mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Field({ name, label, type = "text", required, className, defaultValue }: { name: string; label: string; type?: string; required?: boolean; className?: string; defaultValue?: string }) {
  return (
    <div className={className}>
      <label className="text-sm font-semibold block mb-1.5">{label}{required && <span className="text-destructive"> *</span>}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full px-3 py-2.5 rounded-xl bg-card border border-border outline-none focus:border-primary text-sm" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}
