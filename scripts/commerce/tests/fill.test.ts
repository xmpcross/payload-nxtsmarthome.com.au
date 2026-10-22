/**
 * `prices.sh fill`: choosing the product page that replaces a search-page offer
 * (scripts/commerce/lib/fill.ts). Cases from the 22 Oct 2026 dry runs.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amazonTitle, organicTitle, pickProductPage } from '../lib/fill'
import { retailerByName } from '../lib/au-retailers'

const amazon = retailerByName('Amazon AU')!
const jb = retailerByName('JB Hi-Fi')!

test('Amazon: brand restored from the URL slug, clean /dp/ URL, AUD price', () => {
  const item = { type: 'amazon_serp', title: 'Hub M3, Home Automation, Matter Controller, Thread Border Router', data_asin: 'B0D3M477QD',
    url: 'https://www.amazon.com.au/Aqara-Automation-Controller-Features-Bluetooth/dp/B0D3M477QD/ref=sr_1_1', price_from: 127, currency: 'AUD' }
  assert.equal(amazonTitle(item, 'Aqara'), 'Aqara Hub M3, Home Automation, Matter Controller, Thread Border Router')
  const { hit } = pickProductPage({ brand: 'Aqara', name: 'Hub M3' }, amazon, [
    { title: 'Hub M200, Zigbee Hub & Matter Controller', data_asin: 'B0G2KBRBFC', url: 'https://www.amazon.com.au/Aqara-Controller/dp/B0G2KBRBFC', price_from: 99 },
    item,
  ], true)
  assert.equal(hit?.url, 'https://www.amazon.com.au/dp/B0D3M477QD')
  assert.equal(hit?.price, 127)
})

test('Amazon: no brand anywhere, accessories and spec-only names never match', () => {
  const echoLike = { title: 'All-New Smart speaker Charcoal', data_asin: 'B09B8YP8KY', url: 'https://www.amazon.com.au/All-New-release-Smart-speaker-Charcoal/dp/B09B8YP8KY' }
  assert.equal(pickProductPage({ brand: 'Apple', name: 'HomePod' }, amazon, [echoLike], true).hit, undefined)
  const stand = { title: 'Speaker Floor Stand Compatible with Apple Homepod 1st and 2nd Generation', data_asin: 'B0AAAAAAAA', url: 'https://www.amazon.com.au/Stand/dp/B0AAAAAAAA' }
  assert.equal(pickProductPage({ brand: 'Apple', name: 'HomePod (2nd Generation)' }, amazon, [stand], true).hit, undefined)
})

test('Google site: results: product pages only, retailer suffix dropped, query strings removed', () => {
  const items = [
    { title: 'Search results for Aqara Hub M100 | JB Hi-Fi', url: 'https://www.jbhifi.com.au/search?query=aqara' },
    { title: 'Smart Home Hubs | JB Hi-Fi', url: 'https://www.jbhifi.com.au/collections/smart-home/hubs' },
    { title: 'Aqara U100 with M100 Smart Lock Hub Kit | JB Hi-Fi', url: 'https://www.jbhifi.com.au/products/aqara-u100-with-m100-smart-lock-hub-kit' },
    { title: 'Aqara Hub M100 (White) | JB Hi-Fi', url: 'https://www.jbhifi.com.au/products/aqara-hub-m100-white?srsltid=abc' },
  ]
  const { hit, options } = pickProductPage({ brand: 'Aqara', name: 'Hub M100' }, jb, items, false)
  assert.equal(options.length, 2) // the search and collection pages are not product pages
  assert.equal(hit?.url, 'https://www.jbhifi.com.au/products/aqara-hub-m100-white')
  assert.equal(hit?.price, null) // Google results carry no price: the offer keeps its own
  assert.equal(organicTitle('Philips Hue Bridge - The Good Guys'), 'Philips Hue Bridge')
})

test('a page on another retailer or host is ignored', () => {
  const { options } = pickProductPage({ brand: 'Aqara', name: 'Hub M100' }, jb, [{ title: 'Aqara Hub M100', url: 'https://www.binglee.com.au/products/aqara-hub-m100' }], false)
  assert.equal(options.length, 0)
})

test('product-page patterns accept the stored direct URLs and reject search/category pages', () => {
  const ok: Array<[string, string]> = [
    ['The Good Guys', 'https://www.thegoodguys.com.au/ring-floodlight-cam-wired-plus-white-b08f6h9rzt'],
    ['Harvey Norman', 'https://www.harveynorman.com.au/ring-indoor-cam-2nd-generation-2-pack-security-camera-white.html'],
    ['Officeworks', 'https://www.officeworks.com.au/shop/officeworks/p/ring-outdoor-camera-stick-up-cam-exrsuc3we'],
    ['Bunnings', 'https://www.bunnings.com.au/ring-white-2nd-gen-indoor-camera-2-pack_p0494890'],
    ['Bing Lee', 'https://www.binglee.com.au/products/echo-hub-smart-control-panel-b0bcr4yw51'],
    ['Kogan AU', 'https://www.kogan.com/au/buy/ring-video-doorbell-plus-00840268914028/'],
    ['Scorptec', 'https://www.scorptec.com.au/product/networking/adapters/104849-sh-shelly4pmpro'],
    ['Mwave', 'https://www.mwave.com.au/products/aqara-t1-temperature-and-humidity-sensor-ac79905'],
    ['BIG W', 'https://www.bigw.com.au/product/ring-video-doorbell-pro-wired-black/p/9900295256'],
    ['Kmart', 'https://www.kmart.com.au/product/tp-link-tapo-multicolour-wifi-smart-bulb-e27-base-110032418/'],
  ]
  for (const [name, url] of ok) assert.ok(retailerByName(name)!.productPath!.test(new URL(url).pathname), `${name}: ${url}`)
  assert.equal(retailerByName('The Good Guys')!.productPath!.test('/smart-home'), false)
  assert.equal(retailerByName('eBay AU')!.productPath, undefined)
})
