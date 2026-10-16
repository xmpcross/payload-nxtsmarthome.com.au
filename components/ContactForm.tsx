'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Contact form for a statically exported site.
 *
 * There is no server behind these pages — `output: 'export'` means nginx serves
 * files and nothing else — so the form posts to a small handler of our own at
 * NEXT_PUBLIC_CONTACT_ENDPOINT rather than to a Next route handler, which
 * cannot exist here.
 *
 * Two things guard it, neither of which asks the reader to prove they are human:
 *
 *   A honeypot field, hidden from people and left empty by them, filled in by
 *   most naive bots. Named `company` rather than anything with "bot" or "hp" in
 *   it, since the name is visible in the DOM.
 *
 *   A render timestamp. A submission that arrives within a couple of seconds of
 *   the page rendering was not typed by a person.
 *
 * Both are checked server-side. Doing it here only would stop nothing.
 *
 * The topic is chosen first, as a set of options that each say what to include,
 * so the guidance sits next to the form instead of in notes beside it. The
 * topic values sent to the handler are unchanged.
 */

const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || '/api/contact';

type State = 'idle' | 'sending' | 'sent' | 'error';

const TOPICS = [
  {
    value: 'Correction to an article',
    label: 'A correction',
    summary: 'Something we published is wrong.',
    guidance:
      'Include the article URL and what is wrong. We fix errors and note the correction rather than quietly editing.',
    placeholder: 'The article URL, what it says, and what is wrong with it.',
  },
  {
    value: 'Coverage request',
    label: 'A coverage request',
    summary: 'A device, platform or problem to cover.',
    guidance:
      'Tell us the device, platform or problem you are stuck on. Reader requests genuinely shape what we write next, especially Australian-specific questions no one else is answering.',
    placeholder: 'What you would like us to cover, and why it matters in your home.',
  },
  {
    value: 'PR or review unit',
    label: 'PR or a review unit',
    summary: 'For brands and agencies.',
    guidance:
      'We accept review units on the condition that there is no agreement, expressed or implied, about what we will say. We do not return units in exchange for coverage, we do not send articles for approval before publication, and we disclose loaned hardware in the article. We do not publish sponsored posts or paid link placements.',
    placeholder: 'Who you are, the product, and what you are proposing.',
  },
  {
    value: 'Something else',
    label: 'Something else',
    summary: 'Feedback, questions about the site, anything.',
    guidance: 'Anything else about the site. We read everything that arrives.',
    placeholder: '',
  },
] as const;

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

export default function ContactForm() {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [renderedAt] = useState(() => Date.now());
  const [topic, setTopic] = useState<string>(TOPICS[0].value);
  const sentRef = useRef<HTMLHeadingElement>(null);

  const current = TOPICS.find((t) => t.value === topic) ?? TOPICS[0];

  // After sending, move focus to the confirmation so keyboard and screen-reader
  // users land on it rather than on a button that no longer exists.
  useEffect(() => {
    if (state === 'sent') sentRef.current?.focus();
  }, [state]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setState('sending');
    setError('');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? '').trim(),
          email: String(data.get('email') ?? '').trim(),
          topic: String(data.get('topic') ?? ''),
          message: String(data.get('message') ?? '').trim(),
          company: String(data.get('company') ?? ''), // honeypot
          elapsedMs: Date.now() - renderedAt,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `The server replied ${response.status}.`);
      }

      setState('sent');
      form.reset();
      setTopic(TOPICS[0].value);
    } catch (e) {
      // Say what actually failed. "Something went wrong" tells the reader
      // nothing and hides a broken endpoint from us for weeks.
      setState('error');
      setError(e instanceof Error ? e.message : 'The message could not be sent.');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status">
        <h2
          ref={sentRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight text-neutral-900 outline-none dark:text-white"
        >
          Message sent
        </h2>
        <p className="mt-2 text-neutral-700 dark:text-neutral-300">
          Thanks — we read everything. If it needs a reply you will get one, usually within a few days.
        </p>
        <button
          type="button"
          onClick={() => setState('idle')}
          className={`mt-4 rounded-sm font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
        >
          Send another
        </button>
      </div>
    );
  }

  const field =
    'mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-neutral-900 ' +
    'placeholder:text-neutral-500 focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-500 ' +
    'dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-400';
  const label = 'block font-semibold text-neutral-900 dark:text-white';

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset>
        <legend className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">What is this about?</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOPICS.map((t) => {
            const checked = topic === t.value;
            return (
              <label
                key={t.value}
                className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500 ${
                  checked
                    ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
                    : 'border-neutral-300 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-white'
                }`}
              >
                <input
                  type="radio"
                  name="topic"
                  value={t.value}
                  checked={checked}
                  onChange={() => setTopic(t.value)}
                  className="mt-1 size-4 shrink-0 accent-primary-600 focus:outline-none"
                />
                <span>
                  <span className="block font-semibold text-neutral-900 dark:text-white">{t.label}</span>
                  <span className="mt-0.5 block text-sm text-neutral-700 dark:text-neutral-300">{t.summary}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p
          id="topic-guidance"
          aria-live="polite"
          className="mt-4 max-w-[68ch] border-t border-neutral-200 pt-4 leading-relaxed text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
        >
          {current.guidance}
        </p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={label}>
            Name
          </label>
          <input id="name" name="name" type="text" required autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={field} />
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">Only used to reply to you.</p>
        </div>
      </div>

      <div>
        <label htmlFor="message" className={label}>
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={8}
          aria-describedby="topic-guidance"
          placeholder={current.placeholder || undefined}
          className={field}
        />
      </div>

      {/* Honeypot. Hidden from people, not from bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state === 'error' && (
        <div role="alert" className="rounded-lg border border-red-600/40 px-4 py-3 text-red-800 dark:border-red-400/40 dark:text-red-300">
          {/* The server's message already tells the reader what to do next -
              appending advice here produced "Please email us instead. You can
              also email us directly." */}
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className={`inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
      >
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
