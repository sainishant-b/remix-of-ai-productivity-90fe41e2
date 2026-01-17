-- Add repeat configuration columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN repeat_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN repeat_frequency integer DEFAULT 1,
ADD COLUMN repeat_unit text DEFAULT 'week',
ADD COLUMN repeat_days_of_week integer[] DEFAULT NULL,
ADD COLUMN repeat_times text[] DEFAULT NULL,
ADD COLUMN repeat_end_type text DEFAULT 'never',
ADD COLUMN repeat_end_date timestamp with time zone DEFAULT NULL,
ADD COLUMN repeat_end_count integer DEFAULT NULL,
ADD COLUMN repeat_completed_count integer DEFAULT 0,
ADD COLUMN repeat_parent_id uuid DEFAULT NULL,
ADD COLUMN repeat_series_id uuid DEFAULT NULL;

-- Add constraint for repeat_unit values
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_repeat_unit_check CHECK (repeat_unit IN ('day', 'week', 'month', 'year'));

-- Add constraint for repeat_end_type values
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_repeat_end_type_check CHECK (repeat_end_type IN ('never', 'on_date', 'after_count'));

-- Add index for efficient querying of repeat series
CREATE INDEX idx_tasks_repeat_series_id ON public.tasks(repeat_series_id) WHERE repeat_series_id IS NOT NULL;
CREATE INDEX idx_tasks_repeat_parent_id ON public.tasks(repeat_parent_id) WHERE repeat_parent_id IS NOT NULL;