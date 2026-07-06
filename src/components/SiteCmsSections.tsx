import React from 'react';
import { useSiteCms, SiteCmsSectionPlacement } from '../lib/siteCms';

interface SiteCmsSectionsProps {
  pageSlug: string;
  placement?: SiteCmsSectionPlacement;
  className?: string;
}

export default function SiteCmsSections({ pageSlug, placement, className }: SiteCmsSectionsProps) {
  const { pages, sections } = useSiteCms();
  const page = pages.find((item) => item.slug === pageSlug);
  const visibleSections = sections
    .filter((section) => {
      if (section.pageSlug !== pageSlug) return false;
      if (!section.visible) return false;
      if (!placement) return true;
      const sectionPlacement = section.placement || 'bottom';
      return sectionPlacement === placement;
    })
    .sort((a, b) => a.order - b.order);

  if (!page?.visible || visibleSections.length === 0) return null;

  return (
    <section className={className || 'my-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto'}>
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <article key={section.id} className="rounded-md border border-wood-200 bg-white p-8">
            {section.title && <h2 className="text-2xl font-serif font-bold text-wood-950">{section.title}</h2>}
            {section.content && (
              <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-wood-700">{section.content}</p>
            )}

            {section.highlights.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-l-2 border-gold-500 bg-wood-50 py-4 pl-5 pr-4">
                {section.highlights.map((item, index) => (
                  <li key={`${section.id}-highlight-${index}`} className="text-sm font-medium text-wood-800">
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {section.media.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {section.media.map((image, index) => (
                  <img
                    key={`${section.id}-media-${index}`}
                    src={image.src}
                    alt={image.alt}
                    className="h-28 w-full rounded-sm object-cover"
                  />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
