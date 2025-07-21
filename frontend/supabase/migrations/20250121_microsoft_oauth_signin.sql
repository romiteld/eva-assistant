-- Migration: Microsoft OAuth Sign-in Handler
-- Purpose: Handle Microsoft OAuth authentication and user creation/linking

-- Create or replace the function to handle Microsoft OAuth sign-in
CREATE OR REPLACE FUNCTION handle_microsoft_oauth_signin(
  p_email TEXT,
  p_microsoft_id TEXT,
  p_full_name TEXT
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_existing_user RECORD;
  v_result JSON;
BEGIN
  -- Check if user exists by email
  SELECT id, email, full_name
  INTO v_existing_user
  FROM auth.users
  WHERE email = p_email;

  IF v_existing_user.id IS NOT NULL THEN
    -- User exists, update their Microsoft ID if not already set
    UPDATE auth.users 
    SET 
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'microsoft_id', p_microsoft_id,
          'full_name', p_full_name,
          'provider', 'microsoft'
        ),
      updated_at = NOW()
    WHERE id = v_existing_user.id;

    -- Return success with existing user flag
    v_result := json_build_object(
      'success', true,
      'user_id', v_existing_user.id,
      'existing_user', true,
      'message', 'Microsoft account linked to existing user'
    );
  ELSE
    -- User doesn't exist, we'll need to create them through the welcome flow
    v_result := json_build_object(
      'success', false,
      'existing_user', false,
      'message', 'New user - proceed to registration'
    );
  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log error and return failure
  RAISE LOG 'Error in handle_microsoft_oauth_signin: %', SQLERRM;
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Database error during Microsoft OAuth processing'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_microsoft_oauth_signin(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_microsoft_oauth_signin(TEXT, TEXT, TEXT) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION handle_microsoft_oauth_signin(TEXT, TEXT, TEXT) IS 
'Handles Microsoft OAuth sign-in by checking if user exists and updating metadata or flagging for registration';