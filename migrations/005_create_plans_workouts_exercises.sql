-- 005_create_plans_workouts_exercises.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------
-- plans
-- -------------------------
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_user_id UUID NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  title TEXT NOT NULL,

  start_date DATE NULL,
  end_date DATE NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_coach_user_id ON plans(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_plans_client_id ON plans(client_id);

-- Optional: helper constraint to avoid inverted ranges when both dates present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_date_range_check'
  ) THEN
    ALTER TABLE plans
      ADD CONSTRAINT plans_date_range_check
      CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
  END IF;
END$$;

-- -------------------------
-- workouts
-- -------------------------
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,

  -- 1..7 (Mon..Sun) for simplicity
  scheduled_day INT NOT NULL,

  title TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workouts_plan_id ON workouts(plan_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_scheduled_day_check'
  ) THEN
    ALTER TABLE workouts
      ADD CONSTRAINT workouts_scheduled_day_check
      CHECK (scheduled_day >= 1 AND scheduled_day <= 7);
  END IF;
END$$;

-- -------------------------
-- exercises
-- -------------------------
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  muscle_group TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique exercise names
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_name_unique'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_name_unique UNIQUE (name);
  END IF;
END$$;

-- -------------------------
-- workout_items
-- -------------------------
CREATE TABLE IF NOT EXISTS workout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,

  sets INT NOT NULL,
  reps INT NULL,
  rpe INT NULL,
  notes TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_items_workout_id ON workout_items(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_items_exercise_id ON workout_items(exercise_id);

-- Basic sanity checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_items_sets_check'
  ) THEN
    ALTER TABLE workout_items
      ADD CONSTRAINT workout_items_sets_check CHECK (sets > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_items_reps_check'
  ) THEN
    ALTER TABLE workout_items
      ADD CONSTRAINT workout_items_reps_check CHECK (reps IS NULL OR reps > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workout_items_rpe_check'
  ) THEN
    ALTER TABLE workout_items
      ADD CONSTRAINT workout_items_rpe_check CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10));
  END IF;
END$$;
