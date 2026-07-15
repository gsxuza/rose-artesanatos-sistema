const { createClient } = require('@supabase/supabase-js');

let client;

// Client de servidor: usa a service_role key (nunca exposta ao frontend) e ignora RLS.
function getSupabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

module.exports = { getSupabase };
