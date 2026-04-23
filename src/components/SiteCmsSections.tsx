import React from 'react';
import { useSiteCms } from '../lib/siteCms';

interface SiteCmsSectionsProps {
  pageSlug: string;
  className?: string;
}

export default function SiteCmsSections({ pageSlug, className }: SiteCmsSectionsProps) {
  const { pages, sections } = useSiteCms();
  const page = pages.find((item) => item.slug === pageSlug);
  const visibleSections = sections
    .filter((section) => section.pageSlug === pageSlug && section.visible)
    .sort((a, b) => a.order - b.order);

  if (!page?.visible || visibleSections.length === 0) return null;

  return (
    <section className={className || 'mb-8'}>
      <div className="space-y-4">
        {visibleSections.map((section) => (
          <article key={section.id} className="rounded-2xl border border-wood-200 bg-white p-6 shadow-sm">
            {section.title && <h2 className="text-2xl font-serif font-bold text-wood-900">{section.title}</h2>}
            {section.content && (
              <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-wood-700">{section.content}</p>
            )}

            {section.highlights.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-xl bg-wood-50 p-4">
                {section.highlights.map((item, index) => (
                  <li key={`${section.id}-highlight-${index}`} className="text-sm font-medium text-wood-800">
                    - {item}
                  </li>
                ))}
              </ul>
            )}

            {section.media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {section.media.map((image, index) => (
                  <img
                    key={`${section.id}-media-${index}`}
                    src={image.src}
                    alt={image.alt}
                    className="h-28 w-full rounded-xl object-cover"
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
