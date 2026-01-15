CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: presentations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    system_prompt text,
    user_prompt text,
    style_prompt text,
    transcript text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    outline jsonb,
    pdf_url text,
    user_id uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    presentation_id uuid NOT NULL,
    slide_number integer NOT NULL,
    description text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    system_prompt text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


--
-- Name: presentations presentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentations
    ADD CONSTRAINT presentations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: slides slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_session_id_key UNIQUE (session_id);


--
-- Name: presentations update_presentations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_presentations_updated_at BEFORE UPDATE ON public.presentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_settings update_user_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: presentations presentations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentations
    ADD CONSTRAINT presentations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: slides slides_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.presentations(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: presentations Allow all operations on presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on presentations" ON public.presentations USING (true) WITH CHECK (true);


--
-- Name: slides Allow all operations on slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on slides" ON public.slides USING (true) WITH CHECK (true);


--
-- Name: user_settings Allow all operations on user_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on user_settings" ON public.user_settings USING (true) WITH CHECK (true);


--
-- Name: slides Users can delete slides of their presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete slides of their presentations" ON public.slides FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.presentations
  WHERE ((presentations.id = slides.presentation_id) AND (presentations.user_id = auth.uid())))));


--
-- Name: presentations Users can delete their own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own presentations" ON public.presentations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can delete their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own settings" ON public.user_settings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: slides Users can insert slides to their presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert slides to their presentations" ON public.slides FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.presentations
  WHERE ((presentations.id = slides.presentation_id) AND (presentations.user_id = auth.uid())))));


--
-- Name: presentations Users can insert their own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own presentations" ON public.presentations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_settings Users can insert their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: slides Users can update slides of their presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update slides of their presentations" ON public.slides FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.presentations
  WHERE ((presentations.id = slides.presentation_id) AND (presentations.user_id = auth.uid())))));


--
-- Name: presentations Users can update their own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own presentations" ON public.presentations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can update their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: slides Users can view slides of their presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view slides of their presentations" ON public.slides FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.presentations
  WHERE ((presentations.id = slides.presentation_id) AND (presentations.user_id = auth.uid())))));


--
-- Name: presentations Users can view their own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own presentations" ON public.presentations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_settings Users can view their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: presentations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: slides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;