import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.DEV ? "http://localhost:5173" : window.location.origin,
  // Enable the plugins you need on the client
  plugins: [],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  resetPassword,
  sendEmailVerification,
} = authClient;