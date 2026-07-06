
-- Extend enum with new statuses
ALTER TYPE public.subscription_assignment_status ADD VALUE IF NOT EXISTS 'expiring_soon';
ALTER TYPE public.subscription_assignment_status ADD VALUE IF NOT EXISTS 'renewed';
ALTER TYPE public.subscription_assignment_status ADD VALUE IF NOT EXISTS 'suspended';
