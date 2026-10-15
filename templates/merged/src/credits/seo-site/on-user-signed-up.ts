import "server-only";

import { grantSignupBonus } from "@/lib/credits/ledger";
import { recordFunnelEvent } from "@/lib/funnel/events";
import { FUNNEL_STAGES } from "@/lib/funnel/stages";

export async function onUserSignedUp({ userId }: { userId: string }) {
  try {
    await grantSignupBonus({ userId });
    await recordFunnelEvent({
      stage: FUNNEL_STAGES.SIGNUP,
      userId,
      path: "/sign-up",
    });
  } catch (error) {
    console.error("onUserSignedUp failed", error);
  }
}
