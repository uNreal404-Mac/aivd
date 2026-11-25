"use client";

import * as React from "react";
import { languageSwitchSuffix, localizedHref } from "@/lib/locale-path";
import { usePathname } from "next/navigation";

import { AppearanceOptions } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as Icons from "@/components/ui/icons";

import { i18n, localeMap } from "@/config/i18n-config";

export function LocaleChange() {
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/^\/(en|zh)(?=\/|$)/, "") || "/";

  const [suffix, setSuffix] = React.useState("");
  return (
    <DropdownMenu onOpenChange={open => { if (open) setSuffix(languageSwitchSuffix(window.location.search, window.location.hash)); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0" aria-label={rawPathname.startsWith("/zh") ? "语言与外观" : "Language and appearance"}>
          <Icons.Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div>
          {i18n.locales.map((locale) => {
            return (
              <DropdownMenuItem key={locale} asChild>
                <a
                  href={localizedHref(locale, pathname + suffix)}
                  hrefLang={locale}
                  className="w-full"
                >
                  {localeMap[locale]}
                </a>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <AppearanceOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
