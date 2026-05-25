/* ============================================================
   supabase.js — Auth & database client
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values
   from the Supabase dashboard → Settings → API
   ============================================================ */

const SUPABASE_URL      = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers ─────────────────────────────────────────────

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href
    }
  });
  if (error) console.error('Sign in error:', error.message);
}

async function signOut() {
  await db.auth.signOut();
  window.location.reload();
}

// ── Auth state listener ──────────────────────────────────────

db.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  const loginBtn  = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userInfo  = document.getElementById('user-info');

  if (user) {
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (userInfo)  userInfo.textContent    = user.user_metadata?.full_name?.split(' ')[0] || user.email;
    // Trigger page-specific auth-dependent UI
    document.dispatchEvent(new CustomEvent('user:ready', { detail: user }));
  } else {
    if (loginBtn)  loginBtn.style.display  = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo)  userInfo.textContent    = '';
  }
});

// ── Event sign-up ────────────────────────────────────────────

async function signUpForTasting(tastingSlug, user) {
  const { data, error } = await db
    .from('signups')
    .upsert({
      tasting_slug: tastingSlug,
      user_id:      user.id,
      user_name:    user.user_metadata?.full_name?.split(' ')[0] || 'Friend',
      user_email:   user.email
    }, { onConflict: 'tasting_slug,user_id' });

  return { data, error };
}

async function getSignupsForTasting(tastingSlug) {
  const { data, error } = await db
    .from('signups')
    .select('user_name')
    .eq('tasting_slug', tastingSlug);

  return { data, error };
}

// ── Proposals ────────────────────────────────────────────────

async function submitProposal(text, user) {
  const { data, error } = await db
    .from('proposals')
    .insert({
      text,
      user_id:   user.id,
      user_name: user.user_metadata?.full_name?.split(' ')[0] || 'Friend'
    });

  return { data, error };
}

async function getProposals() {
  const { data, error } = await db
    .from('proposals')
    .select('*, votes(count)')
    .order('created_at', { ascending: false });

  return { data, error };
}

// ── Votes ────────────────────────────────────────────────────

async function voteForProposal(proposalId, user) {
  const { data, error } = await db
    .from('votes')
    .upsert({
      proposal_id: proposalId,
      user_id:     user.id
    }, { onConflict: 'proposal_id,user_id' });

  return { data, error };
}

// ── Bind global buttons ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn  = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginBtn)  loginBtn.addEventListener('click', signInWithGoogle);
  if (logoutBtn) logoutBtn.addEventListener('click', signOut);
});
