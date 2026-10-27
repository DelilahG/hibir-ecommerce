// Demo catalogue. Photos are Unsplash images used under the Unsplash License and are
// illustrative only: they do not show inventory belonging to a real business.

const U = (id: string) => `https://images.unsplash.com/${id}`;

export interface SeedImage {
  url: string;
  alt: string;
  credit: string;
  creditUrl: string;
}

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  image: SeedImage;
}

export interface SeedProduct {
  slug: string;
  name: string;
  category: string;
  description: string;
  details: string[];
  featured?: boolean;
  /** How many days before seeding the product was "added", so the New badge has something to work with. */
  ageDays: number;
  image: SeedImage;
  variants: { sku: string; name: string; price: number; stock: number }[];
}

export const categories: SeedCategory[] = [
  {
    slug: 'apparel',
    name: 'Apparel',
    description: 'Heavyweight basics in plain colours, cut to be worn often.',
    image: { url: U('photo-1737748612418-e39bcd6503a2'), alt: 'Rows of colourful sports shirts on white hangers on a clothing rack', credit: 'Bernd Dittrich', creditUrl: 'https://unsplash.com/@hdbernd' },
  },
  {
    slug: 'audio',
    name: 'Audio',
    description: 'Headphones, speakers and a turntable for listening at home or on the move.',
    image: { url: U('photo-1526394931762-90052e97b376'), alt: 'Overhead view of a black turntable playing a record on a wooden table beside a houseplant', credit: 'Kevin McCutcheon', creditUrl: 'https://unsplash.com/@kevinmccutcheon' },
  },
  {
    slug: 'skincare',
    name: 'Skincare',
    description: 'Short ingredient lists and refillable glass where possible.',
    image: { url: U('photo-1519666251146-8e16c5518edd'), alt: 'Amber pump bottle of hand wash against a black background', credit: 'charlesdeluvio', creditUrl: 'https://unsplash.com/@charlesdeluvio' },
  },
  {
    slug: 'fitness',
    name: 'Fitness',
    description: 'Training gear that holds up to daily sessions.',
    image: { url: U('photo-1620188467120-5042ed1eb5da'), alt: 'Loaded barbell on the floor of a bright gym with gymnastic rings in the foreground', credit: 'Eduardo Cano Photo Co.', creditUrl: 'https://unsplash.com/@eduardocanophotoco' },
  },
  {
    slug: 'home',
    name: 'Home',
    description: 'Ceramics, light and soft textiles for quieter rooms.',
    image: { url: U('photo-1617596225496-1d9da33a144b'), alt: 'Calm living room with a curved grey sofa, cream cushions and a potted plant', credit: 'Deconovo', creditUrl: 'https://unsplash.com/@deconovo' },
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    description: 'Watches, eyewear and the things you carry every day.',
    image: { url: U('photo-1767009951341-73a7c96e1aab'), alt: 'Steel dive watch with a cream dial resting on a tan leather armchair', credit: 'Tim Schmidbauer', creditUrl: 'https://unsplash.com/@timschmidbauer' },
  },
];

const sizes = (prefix: string, price: number, stock: number[]) =>
  ['S', 'M', 'L', 'XL'].slice(0, stock.length).map((s, i) => ({ sku: `${prefix}-${s}`, name: s, price, stock: stock[i] }));

export const products: SeedProduct[] = [
  {
    slug: 'heavyweight-hoodie-cream',
    name: 'Heavyweight Hoodie',
    category: 'apparel',
    description: 'A 450gsm brushed-back cotton hoodie with a double-layer hood and ribbed cuffs. Relaxed through the body without being oversized.',
    details: ['100% organic cotton', 'Colour: cream', 'Machine wash cold'],
    ageDays: 6,
    image: { url: U('photo-1622131527801-78b144aa7f2c'), alt: 'Person seen from behind in a cream hoodie and light sweatpants against a pale stone wall', credit: "Nicola D'Anna", creditUrl: 'https://unsplash.com/@jarvis001' },
    variants: sizes('HB-HOOD', 6800, [8, 14, 11, 4]),
  },
  {
    slug: 'organic-crew-tee-white',
    name: 'Organic Crew Tee',
    category: 'apparel',
    description: 'A mid-weight white tee with a close neckline and a straight hem. Pre-shrunk so the fit stays put after washing.',
    details: ['180gsm organic cotton jersey', 'Colour: white', 'Regular fit'],
    ageDays: 40,
    image: { url: U('photo-1564859228273-274232fdb516'), alt: 'Man seen from behind wearing a white crew-neck t-shirt and tan cap by the sea', credit: 'Sincerely Media', creditUrl: 'https://unsplash.com/@sincerelymedia' },
    variants: sizes('HB-TEE', 2800, [20, 26, 18, 9]),
  },
  {
    slug: 'denim-work-jacket',
    name: 'Denim Work Jacket',
    category: 'apparel',
    description: 'A classic trucker jacket in rigid 13oz denim that softens with wear. Two chest pockets and metal shank buttons.',
    details: ['100% cotton denim', 'Mid-blue wash', 'Fits true to size'],
    ageDays: 75,
    image: { url: U('photo-1575752229768-116115c80c8f'), alt: 'Two people seen from behind in blue denim jackets sitting on a sandy beach', credit: 'Chermiti Mohamed', creditUrl: 'https://unsplash.com/@chermitovee' },
    variants: sizes('HB-DENIM', 9600, [3, 7, 0]),
  },
  {
    slug: 'ribbed-knit-beanie',
    name: 'Ribbed Knit Beanie',
    category: 'apparel',
    description: 'A chunky cream beanie in a wool blend, with a turned-up cuff and a striped band.',
    details: ['70% wool, 30% recycled nylon', 'One size', 'Hand wash'],
    ageDays: 12,
    image: { url: U('photo-1473425940450-bdac1e605495'), alt: 'Person seen from behind wearing a cream knit beanie with a striped band and a chunky knit sweater', credit: 'Francesco Gallarotti', creditUrl: 'https://unsplash.com/@gallarotti' },
    variants: [{ sku: 'HB-BEANIE', name: 'One size', price: 2400, stock: 30 }],
  },
  {
    slug: 'over-ear-wireless-headphones',
    name: 'Over-Ear Wireless Headphones',
    category: 'audio',
    description: 'Closed-back wireless headphones with memory-foam cushions and up to 30 hours of playback. Folds flat into the included case.',
    details: ['Bluetooth 5.3', 'USB-C charging', 'Wired 3.5mm mode'],
    featured: true,
    ageDays: 3,
    image: { url: U('photo-1553774661-0651f14b2da4'), alt: 'Black over-ear headphones resting on a light grey sofa', credit: 'Petr Macháček', creditUrl: 'https://unsplash.com/@machec' },
    variants: [{ sku: 'HB-HEAD-BLK', name: 'Black', price: 18900, stock: 12 }],
  },
  {
    slug: 'wireless-earbuds',
    name: 'Wireless Earbuds',
    category: 'audio',
    description: 'Compact earbuds with a pocketable charging case. A light, open fit for calls and commuting.',
    details: ['Up to 5 hours per charge', 'Charging case included', 'USB cable included'],
    ageDays: 50,
    image: { url: U('photo-1574920162043-b872873f19c8'), alt: 'White wireless earbuds, charging case and coiled cable on a light grey surface', credit: 'Daniel Romero', creditUrl: 'https://unsplash.com/@rmrdnl' },
    variants: [{ sku: 'HB-BUDS-WHT', name: 'White', price: 12900, stock: 5 }],
  },
  {
    slug: 'strap-bluetooth-speaker',
    name: 'Strap Bluetooth Speaker',
    category: 'audio',
    description: 'A round portable speaker with a fabric grille and a leather carry strap. Splash resistant and loud enough for a small room.',
    details: ['12 hours of playback', 'IPX5 splash resistant', 'Colour: olive'],
    ageDays: 20,
    image: { url: U('photo-1549400854-b4300f444934'), alt: 'Round olive-green portable speaker with a leather strap on a tan and brown background', credit: 'Ryan Waring', creditUrl: 'https://unsplash.com/@ryanwaring' },
    variants: [{ sku: 'HB-SPKR-OLV', name: 'Olive', price: 7900, stock: 17 }],
  },
  {
    slug: 'belt-drive-turntable',
    name: 'Belt-Drive Turntable',
    category: 'audio',
    description: 'A two-speed belt-drive turntable with an aluminium tonearm and a pre-fitted cartridge. Built-in switchable phono preamp.',
    details: ['33⅓ and 45 RPM', 'Switchable phono preamp', 'Dust cover included'],
    ageDays: 90,
    image: { url: U('photo-1659545730194-cbdb852f299d'), alt: 'Black-and-white close-up of a turntable tonearm resting on a vinyl record', credit: 'Stephen Harlan', creditUrl: 'https://unsplash.com/@gogostevie' },
    variants: [{ sku: 'HB-TURN', name: 'Black', price: 24900, stock: 4 }],
  },
  {
    slug: 'daily-face-oil',
    name: 'Daily Face Oil',
    category: 'skincare',
    description: 'A lightweight blend of squalane and jojoba oils in amber glass. Three or four drops after cleansing, morning or night.',
    details: ['Fragrance free', 'Amber glass bottle', 'Available in 30ml and 50ml'],
    ageDays: 9,
    image: { url: U('photo-1671493233978-364fd0e59c93'), alt: 'Two amber glass bottles with black caps lying on cream gauze fabric', credit: 'Denise Chan', creditUrl: 'https://unsplash.com/@elchan' },
    variants: [
      { sku: 'HB-OIL-30', name: '30ml', price: 3400, stock: 22 },
      { sku: 'HB-OIL-50', name: '50ml', price: 4800, stock: 10 },
    ],
  },
  {
    slug: 'rich-night-balm',
    name: 'Rich Night Balm',
    category: 'skincare',
    description: 'A thick shea and ceramide balm for dry skin, in a frosted glass jar with a wooden lid.',
    details: ['50ml', 'Fragrance free', 'Glass jar, wooden lid'],
    ageDays: 35,
    image: { url: U('photo-1642683496509-121deffa9cf0'), alt: 'Small frosted glass jar with its wooden lid beside it on a white table', credit: 'everdrop GmbH', creditUrl: 'https://unsplash.com/@everdrop' },
    variants: [{ sku: 'HB-BALM', name: '50ml', price: 3800, stock: 14 }],
  },
  {
    slug: 'everyday-hand-cream',
    name: 'Everyday Hand Cream',
    category: 'skincare',
    description: 'A fast-absorbing hand cream that does not leave a greasy film. Small enough for a coat pocket.',
    details: ['75ml tube', 'Lightly scented with vetiver', 'Recyclable aluminium tube'],
    ageDays: 60,
    image: { url: U('photo-1620917669809-1af0497965de'), alt: 'Cream-coloured skincare tube with a black cap on a plain white background', credit: 'Mathilde Langevin', creditUrl: 'https://unsplash.com/@mathildelangevin' },
    variants: [{ sku: 'HB-HAND', name: '75ml', price: 1600, stock: 40 }],
  },
  {
    slug: 'handmade-bar-soap',
    name: 'Handmade Bar Soap, Set of 3',
    category: 'skincare',
    description: 'Cold-process olive oil soaps, cured for six weeks and tied with cotton twine. Each bar is cut by hand, so sizes vary slightly.',
    details: ['3 × approx. 100g', 'Olive and coconut oil base', 'Plastic-free packaging'],
    ageDays: 100,
    image: { url: U('photo-1454873019514-eae2f086587a'), alt: 'Handmade soap bars tied with blue-and-white twine on a wooden tray', credit: 'Kristina Balić', creditUrl: 'https://unsplash.com/@daisyk9' },
    variants: [{ sku: 'HB-SOAP-3', name: 'Set of 3', price: 1800, stock: 0 }],
  },
  {
    slug: 'court-low-sneaker',
    name: 'Court Low Sneaker',
    category: 'fitness',
    description: 'A white leather low-top with a cushioned cupsole. Equally at home on a court or on the walk there.',
    details: ['Leather upper', 'Rubber cupsole', 'EU sizing'],
    ageDays: 15,
    image: { url: U('photo-1579338908476-3a3a1d71a706'), alt: 'Pair of white low-top sneakers hanging by their laces on a blue tennis court fence', credit: 'Ryan Plomp', creditUrl: 'https://unsplash.com/@ryancp' },
    variants: ['40', '41', '42', '43', '44'].map((s, i) => ({ sku: `HB-COURT-${s}`, name: `EU ${s}`, price: 11000, stock: [6, 9, 2, 7, 0][i] })),
  },
  {
    slug: 'studio-yoga-mat',
    name: 'Studio Yoga Mat',
    category: 'fitness',
    description: 'A 5mm natural rubber mat with a grippy top layer that stays put in hot rooms.',
    details: ['183 × 66cm', '5mm thick', 'Colour: sky blue'],
    ageDays: 28,
    image: { url: U('photo-1548966268-b978ed7b2e83'), alt: 'Woman kneeling on a light blue yoga mat in front of a concrete wall', credit: 'Tim Chow', creditUrl: 'https://unsplash.com/@rkdamedia' },
    variants: [{ sku: 'HB-MAT-SKY', name: 'Sky blue', price: 5200, stock: 13 }],
  },
  {
    slug: 'hex-dumbbell-pair',
    name: 'Hex Dumbbell Pair',
    category: 'fitness',
    description: 'Rubber-coated hex dumbbells that will not roll away, with knurled chrome handles. Sold as a pair.',
    details: ['Rubber-coated cast iron', 'Sold in pairs', 'Weight per dumbbell'],
    ageDays: 55,
    image: { url: U('photo-1638536534984-0d98ccdb6af5'), alt: 'Overhead black-and-white shot of two black hex dumbbells on a light grey floor', credit: 'VD Photography', creditUrl: 'https://unsplash.com/@vdphotography' },
    variants: [
      { sku: 'HB-HEX-5', name: '2 × 5kg', price: 4500, stock: 10 },
      { sku: 'HB-HEX-8', name: '2 × 8kg', price: 6200, stock: 6 },
      { sku: 'HB-HEX-10', name: '2 × 10kg', price: 7800, stock: 3 },
    ],
  },
  {
    slug: 'insulated-steel-bottle',
    name: 'Insulated Steel Bottle',
    category: 'fitness',
    description: 'A double-walled stainless steel bottle that keeps drinks cold for 24 hours. Leak-proof loop cap.',
    details: ['750ml', 'Double-wall vacuum insulation', 'Colour: graphite'],
    featured: true,
    ageDays: 4,
    image: { url: U('photo-1544003484-3cd181d17917'), alt: 'Matte grey stainless steel water bottle with a black loop cap on a white background', credit: 'Karl Köhler', creditUrl: 'https://unsplash.com/@karlkoehler' },
    variants: [{ sku: 'HB-BOTTLE-750', name: '750ml', price: 3200, stock: 35 }],
  },
  {
    slug: 'lidded-stoneware-cups',
    name: 'Lidded Stoneware Cups, Pair',
    category: 'home',
    description: 'Two glazed stoneware cups with fitted lids, for tea, sugar or small things on a desk.',
    details: ['Set of 2', 'Dishwasher safe', 'Made in Portugal'],
    ageDays: 18,
    image: { url: U('photo-1610219171722-87b3f4170557'), alt: 'Two off-white ceramic cups on a white table, one with its lid off', credit: 'Mathilde Langevin', creditUrl: 'https://unsplash.com/@mathildelangevin' },
    variants: [{ sku: 'HB-CUPS-2', name: 'Off-white', price: 3600, stock: 9 }],
  },
  {
    slug: 'rolled-beeswax-tapers',
    name: 'Rolled Beeswax Tapers',
    category: 'home',
    description: 'Hand-rolled pure beeswax candles with a cotton wick. They burn slowly with a faint honey scent.',
    details: ['Pack of 4', 'Approx. 6 hours burn each', 'Holder not included'],
    ageDays: 8,
    image: { url: U('photo-1732117924212-39bfaec174c9'), alt: 'Lit rolled beeswax taper candle in a metal holder', credit: 'Ian Murray', creditUrl: 'https://unsplash.com/@ianmurrays' },
    variants: [{ sku: 'HB-TAPER-4', name: 'Pack of 4', price: 1400, stock: 50 }],
  },
  {
    slug: 'washed-linen-cushion',
    name: 'Washed Linen Cushion',
    category: 'home',
    description: 'A stone-washed linen cover with a hidden zip, sold with a feather-blend insert.',
    details: ['100% linen cover', 'Insert included', 'Colour: white'],
    ageDays: 45,
    image: { url: U('photo-1629949009710-2df14c41a72e'), alt: 'Plain white square cushion on a grey knit throw, with a latte, a magazine and dried flowers', credit: 'Mediamodifier', creditUrl: 'https://unsplash.com/@mediamodifier' },
    variants: [
      { sku: 'HB-CUSH-45', name: '45 × 45cm', price: 4200, stock: 12 },
      { sku: 'HB-CUSH-60', name: '60 × 60cm', price: 5400, stock: 5 },
    ],
  },
  {
    slug: 'brass-table-lamp',
    name: 'Brass Table Lamp',
    category: 'home',
    description: 'A brass-finish lamp with a pleated cream shade that gives off a warm, diffused light.',
    details: ['E27 bulb, not included', '1.8m fabric cable', 'Height 48cm'],
    ageDays: 70,
    image: { url: U('photo-1592195986398-5484c0890b74'), alt: 'Brass table lamp with a cream pleated shade on a dark side table', credit: 'wu yi', creditUrl: 'https://unsplash.com/@takeshi2' },
    variants: [{ sku: 'HB-LAMP', name: 'Brass', price: 16500, stock: 2 }],
  },
  {
    slug: 'navy-dial-bracelet-watch',
    name: 'Navy Dial Bracelet Watch',
    category: 'accessories',
    description: 'A 38mm quartz watch with a navy sunray dial and a matching metal bracelet. Water resistant to 50m.',
    details: ['38mm case', 'Japanese quartz movement', '5 ATM water resistance'],
    featured: true,
    ageDays: 2,
    image: { url: U('photo-1623998021450-85c29c644e0d'), alt: 'Analog wristwatch with a navy dial, gold case and navy metal bracelet on a white background', credit: 'Saif71.com', creditUrl: 'https://unsplash.com/@saif71' },
    variants: [{ sku: 'HB-WATCH-NVY', name: 'Navy / gold', price: 21000, stock: 7 }],
  },
  {
    slug: 'aviator-sunglasses',
    name: 'Aviator Sunglasses',
    category: 'accessories',
    description: 'Lightweight metal aviators with tinted lenses that block 100% of UVA and UVB light.',
    details: ['Rose-gold metal frame', 'Lavender tinted lenses', 'Case included'],
    ageDays: 25,
    image: { url: U('photo-1747731141445-7656d7467969'), alt: 'Rose-gold aviator sunglasses with lavender lenses on a light grey surface', credit: 'ZEELOOL Glasses', creditUrl: 'https://unsplash.com/@zeelool_official' },
    variants: [{ sku: 'HB-AVI-RG', name: 'Rose gold', price: 9500, stock: 11 }],
  },
  {
    slug: 'hand-stitched-leather-wallet',
    name: 'Hand-Stitched Leather Wallet',
    category: 'accessories',
    description: 'A slim bifold in vegetable-tanned leather, saddle-stitched by hand. Six card slots and a note pocket.',
    details: ['Vegetable-tanned leather', '6 card slots', 'Colour: dark brown'],
    ageDays: 65,
    image: { url: U('photo-1512415073221-64c70eee25bc'), alt: 'Dark brown hand-stitched leather wallet on a grey concrete surface', credit: 'charlesdeluvio', creditUrl: 'https://unsplash.com/@charlesdeluvio' },
    variants: [{ sku: 'HB-WALLET-BRN', name: 'Dark brown', price: 5800, stock: 15 }],
  },
  {
    slug: 'everyday-backpack',
    name: 'Everyday Backpack',
    category: 'accessories',
    description: 'A 20-litre backpack in water-resistant canvas, with a padded laptop sleeve and a front zip pocket.',
    details: ['20L capacity', 'Fits a 15" laptop', 'Colour: red'],
    ageDays: 33,
    image: { url: U('photo-1599868082389-59b00bb8760d'), alt: 'Red fabric backpack standing on a chair against a pale wall', credit: 'Kawica Stewart', creditUrl: 'https://unsplash.com/@kawica' },
    variants: [{ sku: 'HB-PACK-RED', name: 'Red', price: 8500, stock: 8 }],
  },
];
