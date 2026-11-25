"use client";

import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppearanceOptions() {
  const zh = useLocale().startsWith("zh");
  const { theme, setTheme } = useTheme();
  return <>
    <DropdownMenuLabel>{zh ? "外观" : "Appearance"}</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
      <DropdownMenuRadioItem value="system">{zh ? "跟随系统" : "System"}</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">{zh ? "深色" : "Dark"}</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="light">{zh ? "浅色" : "Light"}</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </>;
}

export function ModeToggle() {
  const zh = useLocale().startsWith("zh");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={zh ? "选择外观" : "Choose appearance"}>
          <Sun className="dark:hidden" aria-hidden="true" />
          <Moon className="hidden dark:block" aria-hidden="true" />
          {zh ? "外观" : "Appearance"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end"><AppearanceOptions /></DropdownMenuContent>
    </DropdownMenu>
  );
}
