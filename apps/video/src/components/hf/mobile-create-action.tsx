"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { creationLabel } from "@/lib/creation-label";
import { localizedHref } from "@/lib/du-home";
import "@/styles/conversion-home-mobile.css";

export function MobileCreateAction({ lang }: { lang: string }) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("conversion-hero");
    if (!hero) return;

    const observer = new IntersectionObserver(([entry]) => {
      setPastHero(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  if (!pastHero) return null;

  return (
    <div className="du-mobile-create">
      <Link className="du-primary" href={localizedHref(lang, "/text-to-video")}>
        {creationLabel(lang)}
        <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
