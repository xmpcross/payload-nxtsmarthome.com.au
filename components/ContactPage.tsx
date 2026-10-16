import ContactForm from './ContactForm';

/**
 * /contact/ layout, matching /about/: an eyebrow and h1 hero, then the form in
 * a card beside the context notes, each note its own card.
 *
 * The words still come from the Payload page body. CmsPage lifts its <header>
 * (h1 and intro) and <aside> (the notes) out and strips their class attributes,
 * so the styling lives here and in globals.css (.contact-hero, .contact-notes)
 * rather than in classes stored in the CMS, which Tailwind never scans.
 */
export default function ContactPage({ hero, notes }: { hero: string; notes: string }) {
  return (
    <div className="pb-20 lg:pb-28">
      <section className="container pt-12 lg:pt-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wider text-brand-600 uppercase dark:text-brand-400">Get in touch</p>
          <div className="contact-hero" dangerouslySetInnerHTML={{ __html: hero }} />
        </div>
      </section>

      <section className="container mt-14 lg:mt-20">
        <div className="grid gap-[15px] lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
            <ContactForm />
          </div>
          {/* Stacks under the form on narrow screens. */}
          <aside className="contact-notes grid gap-[15px]" dangerouslySetInnerHTML={{ __html: notes }} />
        </div>
      </section>
    </div>
  );
}
