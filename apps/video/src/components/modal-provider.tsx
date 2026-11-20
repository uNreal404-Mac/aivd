"use client";

import { useEffect } from "react";
import { SignInModalContent } from "@/components/sign-in-modal";
import { CreditsUpgradeModal } from "@/components/upgrade/credits-upgrade-modal";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useMounted } from "@/hooks/use-mounted";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "next-intl";

export const ModalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const mounted = useMounted();
  const signInModal = useSigninModal();
  const locale = useLocale();

  useEffect(() => {
    const handleLoginLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self")) return;
      const url = new URL(anchor.getAttribute("href")!, window.location.href);
      if (url.origin !== window.location.origin || !/^\/(?:[a-z]{2}\/)?(?:login|register)\/?$/.test(url.pathname)) return;
      event.preventDefault();
      event.stopPropagation();
      signInModal.onOpenWithRedirect(url.searchParams.get("callbackURL") ?? `${window.location.pathname}${window.location.search}`);
    };
    document.addEventListener("click", handleLoginLink, true);
    return () => document.removeEventListener("click", handleLoginLink, true);
  }, [signInModal]);

  return (
    <>
      {children}
      {mounted && (
        <Dialog open={signInModal.isOpen} onOpenChange={(open) => {
          if (open) {
            signInModal.onOpen();
          } else {
            signInModal.onClose();
          }
        }}>
          <DialogContent className="bottom-auto left-1/2 top-1/2 max-h-[calc(100svh-2rem)] w-[min(92vw,640px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-y-auto rounded-2xl p-0">
            {/* Hidden title for accessibility */}
            <DialogTitle className="sr-only">
              Sign In
            </DialogTitle>
            <SignInModalContent lang={locale} />
          </DialogContent>
        </Dialog>
      )}
      {mounted && <CreditsUpgradeModal lang={locale} />}
    </>
  );
};
