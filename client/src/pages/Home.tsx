import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { ProductCard } from '../components/ProductCard';
import { ErrorState, SkeletonGrid } from '../components/ui';
import { formatPriceRange, sized } from '../lib/format';
import { editorial } from '../lib/editorial';
import type { Category, ProductList, ProductSummary } from '../lib/types';
import { useApi } from '../lib/useApi';

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'Free shipping over $75', text: 'Flat $6 below that' },
  { icon: 'wallet', title: 'Pay on delivery', text: 'No card details collected' },
  { icon: 'box', title: 'Live stock', text: 'Checked again at checkout' },
  { icon: 'shield', title: 'Order tracking', text: 'Status updates in your account' },
];

function HeroTile({ product, className }: { product: ProductSummary; className: string }) {
  const img = product.images[0];
  return (
    <Link to={`/product/${product.slug}`} className={`hero-tile ${className}`}>
      {img && <img src={sized(img.url, 240)} alt="" />}
      <span className="hero-tile-name">{product.name}</span>
      <span className="hero-tile-price">{formatPriceRange(product.minPriceCents, product.maxPriceCents)}</span>
    </Link>
  );
}

function SectionHead({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      <Link to={to} className="text-link">
        {linkLabel} <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}

export function Home() {
  const categories = useApi<{ categories: Category[] }>('/categories');
  const latest = useApi<ProductList>('/products?sort=newest&limit=8');
  const featured = useApi<ProductList>('/products?featured=1&limit=3');
  const tiles = featured.data?.products ?? [];

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Autumn edit · 2026</p>
            <h1 className="hero-title">
              Good things,
              <br />
              kept simple.
            </h1>
            <p className="hero-lede">
              Apparel, audio, skincare, training gear and homeware in a short, considered range. Every price and stock
              level you see comes straight from our inventory.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-accent">
                Shop the range <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/shop?sort=newest" className="btn btn-outline">
                New in
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-shape" aria-hidden="true" />
            <img className="hero-photo" src={sized(editorial.hero.url, 900)} alt={editorial.hero.alt} />
            {tiles[0] && <HeroTile product={tiles[0]} className="tile-a" />}
            {tiles[1] && <HeroTile product={tiles[1]} className="tile-b" />}
            {tiles[2] && <HeroTile product={tiles[2]} className="tile-c" />}
          </div>
        </div>
      </section>

      <section className="container promises" aria-label="Store policies">
        {PROMISES.map((p) => (
          <div key={p.title} className="promise">
            <Icon name={p.icon} size={28} />
            <div>
              <p className="promise-title">{p.title}</p>
              <p className="promise-text">{p.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="container section">
        <SectionHead title="Shop by category" to="/shop" linkLabel="All products" />
        {categories.error ? (
          <ErrorState error={categories.error} onRetry={categories.reload} />
        ) : (
          <div className="category-grid">
            {(categories.data?.categories ?? Array.from({ length: 6 }, () => null)).map((c, i) =>
              c ? (
                <Link key={c.id} to={`/shop?category=${c.slug}`} className="category-tile">
                  <div className="category-media">
                    {c.imageUrl && <img src={sized(c.imageUrl, 420)} alt={c.imageAlt} loading="lazy" />}
                  </div>
                  <div className="category-label">
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.productCount} products</small>
                    </span>
                    <Icon name="arrowRight" size={18} />
                  </div>
                </Link>
              ) : (
                <div key={i} className="category-tile skeleton" style={{ aspectRatio: '3 / 4' }} aria-hidden="true" />
              ),
            )}
          </div>
        )}
      </section>

      <section className="container section">
        <SectionHead title="New in" to="/shop?sort=newest" linkLabel="View all new" />
        {latest.error ? (
          <ErrorState error={latest.error} onRetry={latest.reload} />
        ) : latest.loading ? (
          <SkeletonGrid count={8} />
        ) : (
          <div className="product-grid">
            {latest.data!.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="container section promo-grid">
        <div className="promo promo-accent">
          <div className="promo-copy">
            <p className="eyebrow eyebrow-light">Training</p>
            <h2 className="promo-title">Kit for early starts</h2>
            <p>Running shoes, mats, weights and bottles that stand up to daily use.</p>
            <Link to="/shop?category=fitness" className="btn btn-light btn-sm">
              Shop fitness
            </Link>
          </div>
          <img src={sized(editorial.promoFitness.url, 700)} alt={editorial.promoFitness.alt} loading="lazy" />
        </div>
        <div className="promo promo-dark">
          <div className="promo-copy">
            <p className="eyebrow eyebrow-light">At home</p>
            <h2 className="promo-title">Slow evenings</h2>
            <p>Candles, ceramics and soft textiles for the room you spend most time in.</p>
            <Link to="/shop?category=home" className="btn btn-light btn-sm">
              Shop home
            </Link>
          </div>
          <img src={sized(editorial.promoHome.url, 700)} alt={editorial.promoHome.alt} loading="lazy" />
        </div>
      </section>
    </>
  );
}
