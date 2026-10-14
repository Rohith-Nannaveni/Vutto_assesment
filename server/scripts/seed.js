// Repeatable seed: wipes users, auctions and bids, then recreates demo data relative to "now".
// Usage: npm run seed   (refuses to run with NODE_ENV=production unless --force is passed)
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Auction } from '../src/models/Auction.js';
import { Bid } from '../src/models/Bid.js';
import { hashPassword } from '../src/services/authService.js';
import { processDueAuctions } from '../src/services/lifecycleService.js';
import { logger } from '../src/utils/logger.js';

const HOUR = 3600e3;
const DAY = 24 * HOUR;

function fail(msg) {
  console.error(`Seed aborted: ${msg}`);
  process.exit(1);
}
if (env.isProduction && !process.argv.includes('--force')) fail('NODE_ENV=production. Re-run with --force if you really intend to wipe this database.');
if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) fail('ADMIN_EMAIL and ADMIN_PASSWORD must be set.');
if (!env.DEMO_USER_PASSWORD) fail('DEMO_USER_PASSWORD must be set.');

// Deterministic pseudo-random so the seed is repeatable.
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

const BUYERS = [
  { name: 'Aarav Mehta', email: 'aarav@example.com' },
  { name: 'Priya Nair', email: 'priya@example.com' },
  { name: 'Rohan Iyer', email: 'rohan@example.com' },
];

const img = (slug) => [`/images/bikes/${slug}-1.svg`, `/images/bikes/${slug}-2.svg`];

// start/end are offsets from now (ms). `bids` is the number of accepted bids to generate.
const LISTINGS = [
  { slug: 'royal-enfield-classic-350', brand: 'Royal Enfield', model: 'Classic 350', year: 2019, km: 18400, cc: 346, cond: 'good', city: 'Hyderabad', price: 95000, inc: 1000, start: -3 * DAY, end: 2 * DAY, bids: 4,
    desc: 'Single-owner Classic 350 in Redditch green with stock exhaust. Serviced at 15,000 km, new rear tyre last year. Minor paint marks on the tank; all papers and both keys available.' },
  { slug: 'ktm-duke-390', brand: 'KTM', model: 'Duke 390', year: 2018, km: 22000, cc: 373, cond: 'good', city: 'Bengaluru', price: 135000, inc: 2000, start: -4 * DAY, end: 5 * HOUR, bids: 5,
    desc: 'Well-maintained Duke 390 with a recent chain and sprocket set and fresh brake pads. Never raced. Small scratches on the left fairing from a low-speed slip, mechanically sound.' },
  { slug: 'yamaha-r15-v3', brand: 'Yamaha', model: 'R15 V3', year: 2020, km: 12500, cc: 155, cond: 'excellent', city: 'Pune', price: 110000, inc: 1000, start: -2 * DAY, end: DAY + 6 * HOUR, bids: 3,
    desc: 'Racing blue R15 V3 with ABS. Always garaged, serviced on schedule at the authorised dealer. Includes the original tool kit and a rear paddock stand.' },
  { slug: 'triumph-speed-400', brand: 'Triumph', model: 'Speed 400', year: 2024, km: 3200, cc: 398, cond: 'excellent', city: 'Mumbai', price: 200000, inc: 2500, start: -DAY, end: 3 * DAY, bids: 2,
    desc: 'Nearly new Speed 400 with factory warranty remaining. Used for weekend rides only. Comes with tank pad and a set of crash protectors fitted.' },
  { slug: 'bajaj-pulsar-ns200', brand: 'Bajaj', model: 'Pulsar NS200', year: 2017, km: 31000, cc: 199, cond: 'fair', city: 'Chennai', price: 55000, inc: 500, start: -DAY, end: 9 * HOUR, bids: 0,
    desc: 'Daily-use NS200 with honest wear: faded decals and a replaced clutch cable. Engine pulls strongly, new battery. A solid project for someone who wants a cheap, fast commuter.' },
  { slug: 'royal-enfield-himalayan', brand: 'Royal Enfield', model: 'Himalayan', year: 2021, km: 16800, cc: 411, cond: 'good', city: 'Hyderabad', price: 145000, inc: 1500, start: -2 * DAY, end: 4 * DAY, bids: 3,
    desc: 'Himalayan fitted with a bash plate, saddle stay and crash guards. Ridden on two touring trips; suspension serviced at 12,000 km. Tyres have about 60 percent life left.' },
  { slug: 'kawasaki-ninja-650', brand: 'Kawasaki', model: 'Ninja 650', year: 2019, km: 9700, cc: 649, cond: 'excellent', city: 'Delhi', price: 410000, inc: 5000, start: DAY, end: 5 * DAY, bids: 0,
    desc: 'Low-mileage Ninja 650 in lime green. Full service history with the dealer, no accidents. Fitted with a tail tidy and frame sliders.' },
  { slug: 'honda-cb350', brand: 'Honda', model: 'CB350', year: 2022, km: 8900, cc: 348, cond: 'excellent', city: 'Kochi', price: 170000, inc: 2000, start: 6 * HOUR, end: 3 * DAY, bids: 0,
    desc: 'H’ness CB350 DLX Pro in pearl night star black. Second owner, regularly serviced. Honda Smartphone Voice Control works, and the original seat is included.' },
  { slug: 'harley-davidson-street-750', brand: 'Harley-Davidson', model: 'Street 750', year: 2016, km: 14300, cc: 749, cond: 'good', city: 'Gurugram', price: 310000, inc: 5000, start: 2 * DAY, end: 6 * DAY, bids: 0,
    desc: 'Street 750 with a Screamin Eagle slip-on and a new battery. Light cosmetic wear on the engine covers. Smooth, torquey and easy to handle in city traffic.' },
  { slug: 'tvs-apache-rtr-200', brand: 'TVS', model: 'Apache RTR 200 4V', year: 2019, km: 24500, cc: 197, cond: 'good', city: 'Ahmedabad', price: 70000, inc: 1000, start: -10 * DAY, end: -3 * DAY, bids: 4,
    desc: 'Apache RTR 200 4V in matte black with dual-channel ABS. Regular oil changes with full synthetic. Single owner, clean title.' },
  { slug: 'suzuki-gixxer-sf', brand: 'Suzuki', model: 'Gixxer SF', year: 2018, km: 27000, cc: 155, cond: 'fair', city: 'Jaipur', price: 50000, inc: 500, start: -8 * DAY, end: -DAY, bids: 0,
    desc: 'Gixxer SF with a cracked mirror and scuffed fairing. Runs well, brakes and tyres are in good order. Listed with a modest starting price.' },
  { slug: 'ducati-monster-821', brand: 'Ducati', model: 'Monster 821', year: 2017, km: 11900, cc: 821, cond: 'excellent', city: 'Bengaluru', price: 550000, inc: 10000, start: -13 * DAY, end: -6 * DAY, bids: 5,
    desc: 'Monster 821 with Termignoni exhaust and a recent desmo service at an authorised workshop. Always stored indoors. Stock parts included.' },
];

async function main() {
  await connectDb();
  await Promise.all([Bid.deleteMany({}), Auction.deleteMany({}), User.deleteMany({})]);

  const adminHash = await hashPassword(env.ADMIN_PASSWORD);
  const buyerHash = await hashPassword(env.DEMO_USER_PASSWORD);
  const admin = await User.create({ name: env.ADMIN_NAME, email: env.ADMIN_EMAIL.toLowerCase(), passwordHash: adminHash, role: 'admin' });
  const buyers = await User.insertMany(BUYERS.map((b) => ({ ...b, passwordHash: buyerHash, role: 'buyer' })));

  const now = Date.now();
  let bidTotal = 0;
  for (const l of LISTINGS) {
    const startTime = new Date(now + l.start);
    const endTime = new Date(now + l.end);
    const auction = await Auction.create({
      title: `${l.year} ${l.brand} ${l.model}`, brand: l.brand, model: l.model, year: l.year,
      mileageKm: l.km, engineCc: l.cc, condition: l.cond, description: l.desc, location: l.city,
      images: img(l.slug), startingPrice: l.price, minIncrement: l.inc, startTime, endTime,
      // Expired listings are seeded as "active" and finalized by the real lifecycle code below.
      status: l.start <= 0 ? 'active' : 'scheduled',
      currentBid: l.price, seller: admin._id,
    });

    if (l.bids > 0) {
      const windowEnd = Math.min(now - 5 * 60e3, endTime.getTime() - HOUR);
      const windowStart = startTime.getTime() + HOUR;
      let amount = l.price;
      let last = -1;
      const docs = [];
      for (let i = 0; i < l.bids; i += 1) {
        let who;
        do { who = Math.floor(rand() * buyers.length); } while (who === last);
        last = who;
        if (i > 0) amount += l.inc * (1 + Math.floor(rand() * 3));
        docs.push({
          auction: auction._id, bidder: buyers[who]._id, amount, sequence: i + 1, source: 'seed',
          createdAt: new Date(windowStart + ((windowEnd - windowStart) * (i + 1)) / (l.bids + 1)),
        });
      }
      await Bid.insertMany(docs);
      const top = docs[docs.length - 1];
      await Auction.updateOne({ _id: auction._id }, { $set: { currentBid: top.amount, bidCount: docs.length, highestBidder: top.bidder } });
      bidTotal += docs.length;
    }
  }

  const result = await processDueAuctions(); // finalizes the expired listings through the real code path
  logger.info('seed.complete', { auctions: LISTINGS.length, bids: bidTotal, ...result });
  console.log(`Seeded 1 admin, ${buyers.length} buyers, ${LISTINGS.length} auctions, ${bidTotal} bids (finalized: ${result.finalized}).`);
  console.log(`Admin login: ${env.ADMIN_EMAIL}`);
  console.log(`Demo buyers: ${BUYERS.map((b) => b.email).join(', ')} (password from DEMO_USER_PASSWORD)`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
