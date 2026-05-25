/* ============================================================
   supabase.js — Auth & database client
   ============================================================ */

const SUPABASE_URL      = 'https://iazxrxrimfakxdbulwsj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenhyeHJpbWZha3hkYnVsd3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTk2ODksImV4cCI6MjA5NTI5NTY4OX0.mPMhsp0-9O3W9OcEwk39owNZee7rUpqB2_a9Ss-YUP0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});

// Handle OAuth redirect — recover session from URL hash
db.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    document.dispatchEvent(new CustomEvent('user:ready', { detail: session.user }));
  }
});

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
  const authState = document.getElementById('auth-state');
  const userInfo  = document.getElementById('user-info');

  if (user) {
    const firstName = user.user_metadata?.full_name?.split(' ')[0] || user.email;
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (authState) authState.textContent   = 'Signed in as';
    if (userInfo)  userInfo.textContent    = firstName;
    document.dispatchEvent(new CustomEvent('user:ready', { detail: user }));
  } else {
    if (loginBtn)  loginBtn.style.display  = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (authState) authState.textContent   = 'You are not logged in';
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

// ── Bind global buttons ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn  = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginBtn)  loginBtn.addEventListener('click', signInWithGoogle);
  if (logoutBtn) logoutBtn.addEventListener('click', signOut);
});
