export const Routes = {
  Root: '/',

  // Marketing routes
  Features: '/#features',
  Faqs: '/#faqs',
  Pricing: '/pricing',
  Blog: '/blog',
  Changelog: '/changelog',
  Roadmap: '/roadmap',
  About: '/about',
  Contact: '/contact',
  Waitlist: '/waitlist',
  Ai: '/ai',
  AiWebSearch: '/ai#web-search',
  AiDecision: '/ai#decision-model',
  AiSummarization: '/ai#text-summarization',
  AiTranslation: '/ai#translation',
  AiTagline: '/ai#tagline-generator',
  AiTts: '/ai#text-to-speech',
  AiImageFal: '/ai#image-generator-fal',
  AiImageCf: '/ai#image-generator-cloudflare',
  AiImageEdit: '/ai#image-editing',
  AiCaption: '/ai#image-captioning',

  // Auth routes
  Auth: '/auth',
  Login: '/auth/login',
  Register: '/auth/register',
  AuthError: '/auth/error',
  ForgotPassword: '/auth/forgot-password',
  ResetPassword: '/auth/reset-password',

  // Legal routes
  TermsOfService: '/terms',
  PrivacyPolicy: '/privacy',
  CookiePolicy: '/cookie',

  // Payment routes
  Payment: '/settings/payment',

  // Dashboard routes
  Dashboard: '/dashboard',

  // Favorites
  Favorites: '/favorites',

  // History
  History: '/history',

  // Generate
  Generate: '/generate',

  // Models
  Models: '/models',

  // Settings routes
  Settings: '/settings',
  SettingsProfile: '/settings/profile',
  SettingsBilling: '/settings/billing',
  SettingsCredits: '/settings/credits',
  SettingsSecurity: '/settings/security',
  SettingsFiles: '/settings/files',
  SettingsApiKeys: '/settings/apikeys',
  SettingsNotifications: '/settings/notifications',

  // Admin routes
  Admin: '/admin',
  AdminUsers: '/admin/users',
  AdminTasks: '/admin/tasks',
  AdminPrompts: '/admin/prompts',
  AdminPromptEdit: '/admin/prompts/$id/edit',
  AdminRedemptions: '/admin/redemptions',
} as const;

/** Default login redirect route */
export const DEFAULT_LOGIN_REDIRECT = Routes.Root;
