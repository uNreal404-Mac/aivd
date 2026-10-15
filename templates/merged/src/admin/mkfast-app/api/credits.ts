import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';
import { auth } from '@/auth/auth';
import { getUserCredits } from '@/credits/credits';
import { redeemCode } from '@/credits/redemption';

export const getCreditBalance = createServerFn({ method: 'GET' }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    return getUserCredits(session.user.id);
  }
);

const redeemCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
});

export const redeemCreditCode = createServerFn({ method: 'POST' })
  .validator(redeemCodeSchema)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const code = data.code.trim();
    if (code.length === 0) {
      throw new Error('Code is required');
    }

    const result = await redeemCode(session.user.id, code.toUpperCase());
    if (result.success) {
      return {
        success: true,
        message: `Code redeemed! +${result.creditsGranted} credits`,
      };
    }
    return {
      success: false,
      error: result.error ?? 'Failed to redeem code',
    };
  });
