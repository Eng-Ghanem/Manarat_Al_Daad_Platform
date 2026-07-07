-- 1. Create the subscriptions table
CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  payment_method text NOT NULL, -- e.g., 'wallet', 'instapay'
  wallet_number text, -- Only required if method is wallet
  receipt_url text, -- Storage URL for the uploaded receipt
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Create Storage Bucket for Receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true);

-- Enable storage access policies
CREATE POLICY "Anyone can upload receipts" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Anyone can view receipts" ON storage.objects FOR SELECT TO public USING (bucket_id = 'receipts');

-- 3. Enable table security policies
CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and update all subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update subscriptions" ON public.subscriptions FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
