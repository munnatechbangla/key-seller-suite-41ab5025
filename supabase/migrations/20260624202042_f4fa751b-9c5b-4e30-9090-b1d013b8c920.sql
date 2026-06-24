
-- Admin read policies (existing schema already has admin manage on most tables)
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all order items" ON public.order_items FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all downloads" ON public.downloads FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all license assignments" ON public.license_assignments FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view all user_roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
