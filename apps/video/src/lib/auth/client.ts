"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { creemClient } from "@creem_io/better-auth/client";

export const authClient = createAuthClient({
  // In the browser, always talk to the site the page came from. The build-time
  // value can be a developer's localhost when the bundle was built locally.
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        isAdmin: { type: "boolean", required: false, input: false },
        isSuperAccount: { type: "boolean", required: false, input: false },
      },
    }),
    magicLinkClient(),
    creemClient(),
  ],
});

// Export commonly used methods
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  creem,
} = authClient;

// Re-export types
export type AuthClient = typeof authClient;

// User type for client components
// This matches the server-side User type structure
export type User = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAdmin?: boolean | null;
  isSuperAccount?: boolean | null;
};
