-- Account-only customer read access: users can see only inventory assigned to their own account orders.
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
  status = 'assigned'
  AND assigned_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.inventory_pools p
    WHERE p.id = inventory_items.pool_id
      AND p.inventory_type = 'account'
  )
);
