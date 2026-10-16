import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import AllTopicsClient, { TopicCategoryData } from '@/components/AllTopicsClient';
import FlyonAccordion from '@/components/flyonui/FlyonAccordion';
import { getCategories } from '@/data/categories';
import { toTPost } from '@/data/posts';
import { getAllArticles } from '@/lib/content';
import { breadcrumbJsonLd, pageAlternates, pageTitle } from '@/lib/seo';
import { getShoppableTopProducts } from '@/lib/products';
import { getCategory, site } from '@/lib/site';
import Link from 'next/link';

import SmartHomeLottieBanner from '@/components/SmartHomeLottieBanner';

const DESCRIPTION =
  'Browse Australian smart home guides by topic: security cameras, lighting, climate, energy, hubs, Matter and Thread, plus setup and buying guides.';

export const metadata: Metadata = {
  // The root template appends " | NXT Smart Home"; the brand is not repeated here.
  title: pageTitle('Smart Home Topics & Categories'),
  description: DESCRIPTION,
  alternates: pageAlternates('/all-topics/'),
};

// Topic counts and the per-topic rows refresh with the articles (ISR).
export const revalidate = 300;

export default async function CategoriesIndex() {
  const articles = await getAllArticles();
  /*
    AllTopicsClient links each post as `/${handle}/`, and toTPost's handle
    already ends in a slash, which produced "//" hrefs (audit H3). Hand it the
    handle without the trailing slash so the link comes out canonical.
  */
  const allPosts = articles.map(toTPost).map((p) => ({ ...p, handle: p.handle.replace(/\/+$/, '') }));
  const rawCats = await getCategories();
  const cats = rawCats.filter((c) => c.count > 0 && c.handle !== 'robot-vacuums' && c.handle !== 'robot-vacuum');
  const withProducts = new Set((await getShoppableTopProducts()).map((p) => p.categorySlug));

  const topicData: TopicCategoryData[] = cats.map((c) => {
    const meta = getCategory(c.handle);
    return {
      id: c.id,
      name: c.name,
      handle: c.handle,
      count: c.count,
      description: c.description,
      emoji: meta?.emoji,
      icon3d: meta?.icon3d,
      iconSvg: meta?.iconSvg,
      intro: meta?.intro,
      subcategories: meta?.subcategories,
      hasProducts: withProducts.has(c.handle),
    };
  });

  const topicFaqs = [
    {
      id: 'au-standards',
      question: 'How do your guides fit Australian electrical rules?',
      answer:
        'Australia uses 230V/50Hz mains power, requiring RCM (Regulatory Compliance Mark) certified hardware. Any 240V in-wall switch or power point requires installation by a licensed Australian electrician. Our guides strictly distinguish between DIY low-voltage devices and electrician-required hardware.',
    },
    {
      id: 'wifi-bands',
      question: 'Why do smart devices need 2.4GHz Wi-Fi?',
      answer:
        'Most IoT microcontrollers (e.g., Tuya, ESP32, Matter over Wi-Fi) operate exclusively on 2.4GHz because it offers far superior range and wall penetration than 5GHz. Australian mesh routers (Telstra Smart Modem, eero, Google Nest Wi-Fi) often band-steer, so our setup guides provide exact steps to split or temporarily separate bands.',
    },
    {
      id: 'ecosystem-choice',
      question: 'Apple Home, Google Home or Alexa: which should I pick?',
      answer:
        'All three platforms have strong Australian localization. Apple Home is best for privacy and fast local execution; Google Home excels at natural voice queries and Nest hardware; Amazon Alexa offers the widest accessory compatibility. Devices supporting Matter or Thread work across all three simultaneously.',
    },
    {
      id: 'matter-thread',
      question: 'What are Matter and Thread?',
      answer:
        'Matter is the universal smart home standard that lets devices from Apple, Google, Amazon, and Samsung talk to each other locally without cloud latency. Thread is a low-power mesh network protocol that replaces Wi-Fi for sensors and smart locks, making response times instant and immune to internet outages.',
    },
    {
      id: 'neutral-wire',
      question: 'Do smart switches need a neutral wire?',
      answer:
        'Most Australian homes built before 2015 do not have a neutral wire at the switch plate. You can either choose "No-Neutral" smart switches (often requiring a bypass capacitor), opt for smart bulbs (Philips Hue, LIFX, Tapo), or install smart inline relays (Shelly, Evvr) behind the switch box or ceiling rose.',
    },
    {
      id: 'home-assistant',
      question: 'Is Home Assistant worth it?',
      answer:
        'Home Assistant provides unmatched local control, privacy, and speed. In Australia, it integrates deeply with local rooftop solar systems (Fronius, Enphase, SolarEdge), dynamic spot electricity tariffs (Amber Electric, AGL), reverse-cycle air conditioners (Daikin, Sensibo), and Zigbee/Z-Wave sensors.',
    },
    {
      id: 'zigbee-zwave',
      question: 'Zigbee vs Z-Wave vs Wi-Fi: what\'s the difference?',
      answer:
        'Wi-Fi devices connect directly to your router without a hub but can crowd 2.4GHz Wi-Fi if you have 30+ devices. Zigbee and Z-Wave create low-power mesh networks where mains-powered devices act as repeaters across multi-storey brick homes. Note that Z-Wave uses Australia\'s specific 921.4MHz frequency band.',
    },
    {
      id: 'smart-locks',
      question: 'Do smart locks fit Australian mortise locks?',
      answer:
        'Australian doors commonly use narrow-stile glass frames or mortise locks (Lockwood, Gainsborough) with euro cylinders, which differ from US deadbolts. Smart locks like the Aqara U200, Eufy Smart Lock C210/C220, or Yale Unity series include retrofittable AU tailpieces and strike plates.',
    },
    {
      id: 'solar-automation',
      question: 'Can I run appliances off my solar automatically?',
      answer:
        'Homes with rooftop solar can maximize self-consumption by running high-draw loads during solar peak hours (10am to 3pm). Using smart power monitoring plugs or Home Assistant automations, you can automatically activate EV chargers, pool pumps, and split-system climate units whenever solar export exceeds your chosen threshold.',
    },
    {
      id: 'privacy-security',
      question: 'How do I secure my smart home network?',
      answer:
        'Always isolate IoT devices on a dedicated Guest Wi-Fi network or VLAN to isolate them from your primary computers and NAS storage. Disable UPnP on your router, keep device firmware updated, enable 2-Factor Authentication (2FA) on cloud accounts, and prioritize local-first protocols like Matter and Zigbee.',
    },
    {
      id: 'need-hub',
      question: 'Do I need a smart home hub?',
      answer:
        'Not always. Wi-Fi devices connect straight to your router and work without a hub. Zigbee and Z-Wave devices need a hub or bridge, and Thread devices need a Thread border router (many recent Apple, Google and Amazon smart speakers and displays include one).',
    },
  ];

  return (
    <div className="page-categories-index min-h-screen bg-neutral-50/50 py-10 dark:bg-neutral-950">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Topics & Categories', path: '/all-topics/' },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Topics & Categories',
          url: `${site.url}/all-topics/`,
          description: DESCRIPTION,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: cats.length,
            itemListElement: cats.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.name,
              url: `${site.url}/categories/${c.handle}/`,
            })),
          },
        }}
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Hero Section — No Background Color, Clean & Un-boxed */}
        <section className="relative grid items-center gap-8 py-4 lg:grid-cols-2 lg:py-6 bg-transparent">
          <div className="max-w-3xl space-y-4">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-50 px-3.5 py-1 text-xs font-bold text-primary-700 dark:border-primary-500/40 dark:bg-primary-950/60 dark:text-primary-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-primary-500"></span>
              </span>
              AUSTRALIAN SMART HOME DIRECTORY & ADVICE HUB
            </div>

            {/* Giant Display Title */}
            <h1 className="text-4xl sm:text-[3rem] font-black tracking-tight text-neutral-900 dark:text-white leading-[1.1]">
              Every Smart Home Topic.{' '}
              <span className="bg-gradient-to-r from-primary-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-primary-400 dark:via-indigo-300 dark:to-purple-400">
                Guides &amp; Reviews for Australian Homes.
              </span>
            </h1>

            <p className="text-base sm:text-lg font-medium leading-relaxed text-neutral-600 dark:text-neutral-300 max-w-2xl">
              Browse {articles.length} in-depth smart home guides, buying advice, and step-by-step setup tutorials across {cats.length} core technology domains — tailored for Australian 230V electrical standards (RCM mark), NBN Wi-Fi dual-band networks, Apple Home, Google Home, and Matter/Thread ecosystems.
            </p>

            {/* Stats Counter Bar — Transparent Hairline Cards */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-200/80 bg-transparent p-3.5 dark:border-neutral-800">
                <div className="text-2xl font-black text-primary-600 dark:text-primary-400">{articles.length}</div>
                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-0.5">Australian Guides</div>
              </div>
              <div className="rounded-2xl border border-neutral-200/80 bg-transparent p-3.5 dark:border-neutral-800">
                <div className="text-2xl font-black text-primary-600 dark:text-primary-400">{cats.length}</div>
                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-0.5">Topic Categories</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <SmartHomeLottieBanner />
          </div>
        </section>

        {/* Main Interactive Category & Article Directory Component */}
        <section className="mt-8">
          <AllTopicsClient categories={topicData} posts={allPosts} />
        </section>

        {/* Redesigned Australian Standards & Buying Advice FAQ Section (2-Column Accordions) */}
        <section className="mt-20 pt-10 border-t border-neutral-200 dark:border-neutral-800 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="relative">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
                  Frequently Asked Smart Home Questions
                </h2>
                <span className="absolute -bottom-3 left-0 h-0.5 w-16 bg-primary-600 dark:bg-primary-400" />
              </div>
              <p className="pt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
                Essential knowledge for setting up smart devices safely and reliably under Australian electrical & network rules.
              </p>
            </div>

            <Link
              href="/how-we-test/"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-800 hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-400 dark:hover:text-primary-400 transition-colors shadow-xs"
            >
              <span>How We Research</span>
              <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
            </Link>
          </div>

          {/* 2-Column Accordion Layout */}
          <div className="pt-2">
            <FlyonAccordion items={topicFaqs} columns={2} />
          </div>
        </section>
      </div>
    </div>
  );
}
