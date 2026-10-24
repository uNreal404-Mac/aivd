"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as Icons from "@/components/ui/icons";

import { i18n, localeMap } from "@/config/i18n-config";

export function LocaleChange() {
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/^\/(en|zh)(?=\/|$)/, "") || "/";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
          <Icons.Languages />
          <span className="sr-only" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div>
          {i18n.locales.map((locale) => {
            return (
              // <Link href={redirectedPathName(locale)}>{locale}</Link>
              <DropdownMenuItem key={locale} asChild>
                <a
                  href={locale === i18n.defaultLocale ? pathname : `/${locale}${pathname === "/" ? "" : pathname}`}
                  hrefLang={locale}
                  className="w-full"
                >
                  {localeMap[locale]}
                </a>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
