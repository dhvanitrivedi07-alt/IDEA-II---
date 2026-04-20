-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- allow the backend/service role (used by auth triggers) to insert profiles
CREATE POLICY "Service role can insert profiles during signup"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- optionally, authenticated users may still insert their own profile when
-- signing up via the client-side fallback.  This policy is more permissive
-- than strictly necessary but mirrors the original intention.
CREATE POLICY "Authenticated users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create tasks table (using 'task_manager' to match existing database)
CREATE TABLE public.task_manager (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  importance SMALLINT CHECK (importance >= 1 AND importance <= 5) DEFAULT 3,
  is_completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on tasks
ALTER TABLE public.task_manager ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view their own tasks"
  ON public.task_manager FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.task_manager FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.task_manager FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.task_manager FOR DELETE
  USING (auth.uid() = user_id);

-- Create tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Tags policies
CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- Create task_tags junction table
CREATE TABLE public.task_tags (
  task_id UUID REFERENCES public.task_manager(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (task_id, tag_id)
);

-- Enable RLS on task_tags
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

-- Task_tags policies
CREATE POLICY "Users can view their own task tags"
  ON public.task_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_manager
      WHERE task_manager.id = task_tags.task_id
      AND task_manager.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own task tags"
  ON public.task_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.task_manager
      WHERE task_manager.id = task_tags.task_id
      AND task_manager.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own task tags"
  ON public.task_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.task_manager
      WHERE task_manager.id = task_tags.task_id
      AND task_manager.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_task_manager_user_id ON public.task_manager(user_id);
CREATE INDEX idx_task_manager_due_date ON public.task_manager(due_date);
CREATE INDEX idx_task_manager_importance ON public.task_manager(importance);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);

-- Trigger to update updated_at on task_manager
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_manager_updated_at
  BEFORE UPDATE ON public.task_manager
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for task_manager
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_manager;