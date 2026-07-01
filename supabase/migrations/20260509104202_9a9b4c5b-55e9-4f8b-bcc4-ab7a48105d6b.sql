
-- Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  age INT,
  email TEXT,
  phone TEXT,
  school TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  learning_areas TEXT[] DEFAULT '{}',
  goal TEXT,
  preferred_project_type TEXT,
  availability TEXT,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Recommendations cache (AI output per user)
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recs" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own recs" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recs" ON public.recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins read recs" ON public.recommendations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Started projects (student-initiated)
CREATE TABLE public.started_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  matching_interests TEXT[] DEFAULT '{}',
  difficulty TEXT,
  team_size TEXT,
  first_steps JSONB DEFAULT '[]',
  progress INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.started_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own projects" ON public.started_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own projects" ON public.started_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.started_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all projects" ON public.started_projects FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Opportunities (admin-managed but seeded; readable by all auth users)
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  date DATE,
  duration TEXT,
  difficulty TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can view opportunities" ON public.opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage opportunities" ON public.opportunities FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Participations (student joined an opportunity)
CREATE TABLE public.participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own participations" ON public.participations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users join opportunities" ON public.participations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all participations" ON public.participations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all achievements" ON public.achievements FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profile auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed opportunities
INSERT INTO public.opportunities (title, category, description, duration, difficulty, tags) VALUES
('AI Intro Class', 'Technology', 'Learn the basics of artificial intelligence and how it shapes the future.', '2h', 'Beginner', ARRAY['artificial intelligence','technology']),
('Design Masterclass', 'Design', 'Hands-on session on visual design fundamentals and modern UI.', '3h', 'Intermediate', ARRAY['design','art']),
('Media Creation Workshop', 'Media', 'Create short videos and visual stories for social platforms.', '4h', 'Beginner', ARRAY['media','content creation','filmmaking']),
('Youth Business Discussion', 'Business', 'Open discussion on starting your first venture as a teenager.', '1.5h', 'Beginner', ARRAY['business','entrepreneurship']),
('Armenian History Research Club', 'History', 'Weekly club exploring Armenian historical narratives.', 'Recurring', 'Beginner', ARRAY['history','research']),
('Public Speaking Workshop', 'Communication', 'Build confidence on stage and in conversations.', '2h', 'Beginner', ARRAY['public speaking','leadership']),
('Environmental Action Day', 'Community', 'Hands-on cleanup and awareness in Ejmiatsin.', '5h', 'Beginner', ARRAY['environment','volunteering']),
('Startup Idea Lab', 'Innovation', 'Brainstorm and validate startup ideas with mentors.', '3h', 'Intermediate', ARRAY['entrepreneurship','innovation','business']),
('Photography Session', 'Art', 'Outdoor photography practice and composition basics.', '2h', 'Beginner', ARRAY['photography','art']),
('Community Leadership Meeting', 'Leadership', 'Plan upcoming youth-led initiatives together.', '1.5h', 'Intermediate', ARRAY['leadership','community service']);
