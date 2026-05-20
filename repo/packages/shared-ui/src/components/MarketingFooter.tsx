/**
 * MarketingFooter -- full marketing footer with 4 sections + Maroc legal mentions.
 * Compliant with CNDP / ACAPS / Loi 09-08.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import Link from 'next/link';
import { Facebook, Linkedin, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { LogoSkalean } from './LogoSkalean.js';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

const sections: FooterSection[] = [
  {
    title: 'A propos',
    links: [
      { label: 'Notre mission', href: '/apropos' },
      { label: 'Notre equipe', href: '/equipe' },
      { label: 'Carrieres', href: '/carrieres' },
      { label: 'Presse', href: '/presse' },
    ],
  },
  {
    title: 'Produits',
    links: [
      { label: 'Assurance auto', href: '/auto' },
      { label: 'Assurance habitation', href: '/habitation' },
      { label: 'Assurance sante', href: '/sante' },
      { label: 'Comparateur', href: '/comparateur' },
    ],
  },
  {
    title: 'Partenaires',
    links: [
      { label: 'Compagnies', href: '/partenaires' },
      { label: 'Reseau garages', href: '/garages' },
      { label: 'Courtiers', href: '/courtiers' },
      { label: 'Devenir partenaire', href: '/devenir-partenaire' },
    ],
  },
  {
    title: 'Mentions legales',
    links: [
      { label: 'Conditions generales', href: '/cgu' },
      { label: 'Politique de confidentialite (CNDP / Loi 09-08)', href: '/confidentialite' },
      { label: 'Politique de cookies', href: '/cookies' },
      { label: 'Mentions ACAPS', href: '/mentions-acaps' },
    ],
  },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="border-t bg-muted/30 mt-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2">
            <LogoSkalean className="h-9 w-auto" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Skalean Sofidemy InsurTech -- premiere plateforme assurtech souveraine du Maroc,
              hebergee Atlas Cloud Benguerir, conforme CNDP / ACAPS / Loi 09-08.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://facebook.com/skalean"
                aria-label="Facebook"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Facebook className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="https://linkedin.com/company/skalean"
                aria-label="LinkedIn"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="https://youtube.com/@skalean"
                aria-label="YouTube"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Youtube className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Link sections */}
          {sections.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="font-semibold text-sm mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Contact bar */}
        <div className="mt-10 pt-6 border-t grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Casablanca, Maroc -- Atlas Cloud Benguerir</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <a href="tel:+212522000000" className="hover:text-foreground">
              +212 522 00 00 00
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <a href="mailto:contact@skalean-insurtech.ma" className="hover:text-foreground">
              contact@skalean-insurtech.ma
            </a>
          </div>
        </div>

        {/* Legal bar */}
        <div className="mt-6 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>(c) {year} Skalean Sofidemy InsurTech. Tous droits reserves. Societe agreee ACAPS.</p>
          <p>
            Cabinet de courtage en assurance supervise par l&apos;
            <a href="https://www.acaps.ma" className="underline hover:text-foreground">
              ACAPS
            </a>{' '}
            -- Donnees personnelles :{' '}
            <a href="https://www.cndp.ma" className="underline hover:text-foreground">
              CNDP
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
