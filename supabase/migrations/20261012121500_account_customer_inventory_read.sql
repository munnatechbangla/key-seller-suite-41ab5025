-- Account-only customer read access: users can see only their own active assignments
-- and the assigned account items themselves. Avoid joining inventory_pools in the
-- item policy because that table is admin-only under RLS.
DROP POLICY IF EXISTS "Customers view own account assignments" ON public.inventory_assignments;
CREATE POLICY "Customers view own account assignments"
ON public.inventory_assignments
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND status = 'active');

DROP POLICY IF EXISTS "Customers view own assigned account items" ON public.inventory_items;
CREATE POLICY "Customers view own assigned account items"
ON public.inventory_items
FOR SELECT TO authenticated
USING (
  inventory_type = 'account'
  AND status = 'assigned'
  AND assigned_user_id = auth.uid()
);
