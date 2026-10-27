import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Breadcrumbs, ErrorState, Field, Notice, Select, Spinner, TextArea } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { sized } from '../../lib/format';
import type { Category } from '../../lib/types';
import { useApi } from '../../lib/useApi';

interface VariantForm {
  id?: number;
  sku: string;
  name: string;
  price: string;
  stock: string;
  active: boolean;
}

interface ImageForm {
  url: string;
  alt: string;
  creditName: string;
  creditUrl: string;
}

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  details: string;
  categoryId: string;
  active: boolean;
  featured: boolean;
  images: ImageForm[];
  variants: VariantForm[];
}

interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  details: string[];
  categoryId: number;
  active: boolean;
  featured: boolean;
  images: { url: string; alt: string; creditName: string | null; creditUrl: string | null }[];
  variants: { id: number; sku: string; name: string; priceCents: number; stock: number; active: boolean }[];
}

const blankVariant = (): VariantForm => ({ sku: '', name: 'Default', price: '', stock: '0', active: true });
const blankImage = (): ImageForm => ({ url: '', alt: '', creditName: '', creditUrl: '' });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

function toForm(p: AdminProduct): ProductForm {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    details: p.details.join('\n'),
    categoryId: String(p.categoryId),
    active: p.active,
    featured: p.featured,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, creditName: i.creditName ?? '', creditUrl: i.creditUrl ?? '' })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: (v.priceCents / 100).toFixed(2),
      stock: String(v.stock),
      active: v.active,
    })),
  };
}

function toPayload(f: ProductForm) {
  return {
    name: f.name,
    slug: f.slug,
    description: f.description,
    details: f.details.split('\n').map((d) => d.trim()).filter(Boolean),
    categoryId: Number(f.categoryId),
    active: f.active,
    featured: f.featured,
    images: f.images
      .filter((i) => i.url.trim())
      .map((i) => ({ url: i.url.trim(), alt: i.alt, creditName: i.creditName || null, creditUrl: i.creditUrl.trim() || null })),
    variants: f.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku,
      name: v.name,
      priceCents: Math.round(Number(v.price) * 100),
      stock: Number.parseInt(v.stock, 10),
      active: v.active,
    })),
  };
}

export function ProductEditor() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const categories = useApi<{ categories: Category[] }>('/admin/categories');
  const existing = useApi<{ product: AdminProduct }>(isNew ? null : `/admin/products/${encodeURIComponent(id)}`);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew && categories.data && !form) {
      setForm({
        name: '', slug: '', description: '', details: '', active: true, featured: false,
        categoryId: String(categories.data.categories[0]?.id ?? ''), images: [blankImage()], variants: [blankVariant()],
      });
    }
  }, [isNew, categories.data, form]);

  useEffect(() => {
    if (existing.data) setForm(toForm(existing.data.product));
  }, [existing.data]);

  if (categories.error || existing.error) {
    return <ErrorState error={categories.error ?? existing.error} onRetry={() => { categories.reload(); existing.reload(); }} />;
  }
  if (!form || !categories.data) return <Spinner label="Loading editor" />;

  const update = (patch: Partial<ProductForm>) => {
    setSaved(false);
    setForm((f) => ({ ...f!, ...patch }));
  };
  const updateVariant = (i: number, patch: Partial<VariantForm>) =>
    update({ variants: form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const updateImage = (i: number, patch: Partial<ImageForm>) =>
    update({ images: form.images.map((img, j) => (j === i ? { ...img, ...patch } : img)) });
  const moveImage = (i: number, dir: -1 | 1) => {
    const images = [...form.images];
    [images[i], images[i + dir]] = [images[i + dir], images[i]];
    update({ images });
  };
  const fe = (path: string) => error?.fieldMessage(path);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = toPayload(form!);
      const r = isNew
        ? await api<{ product: AdminProduct }>('/admin/products', { method: 'POST', body })
        : await api<{ product: AdminProduct }>(`/admin/products/${id}`, { method: 'PUT', body });
      if (isNew) navigate(`/admin/products/${r.product.id}`, { replace: true });
      setForm(toForm(r.product));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save the product'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Breadcrumbs items={[{ to: '/admin/products', label: 'Products' }, { label: isNew ? 'New product' : form.name }]} />
      <header className="page-head page-head-row">
        <h1 className="page-title">{isNew ? 'New product' : 'Edit product'}</h1>
        {!isNew && form.active && (
          <Link to={`/product/${form.slug}`} className="text-link">
            View in shop <Icon name="arrowRight" size={16} />
          </Link>
        )}
      </header>

      <form className="editor" onSubmit={onSubmit} noValidate>
        {error && (
          <Notice tone="error">
            {error.message}
            {error.fields.length > 0 && (
              <ul>
                {error.fields.map((f) => (
                  <li key={f.path}>
                    {f.path}: {f.message}
                  </li>
                ))}
              </ul>
            )}
          </Notice>
        )}
        {saved && <Notice tone="success">Saved.</Notice>}

        <section className="panel">
          <h2 className="sub-title">Details</h2>
          <div className="form-grid">
            <Field
              label="Name"
              value={form.name}
              required
              maxLength={120}
              error={fe('name')}
              onChange={(e) => update({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
            />
            <Field
              label="URL slug"
              value={form.slug}
              required
              maxLength={80}
              error={fe('slug')}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: e.target.value });
              }}
            />
            <Select label="Category" value={form.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
              {categories.data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="field toggles">
              <label className="checkbox">
                <input type="checkbox" checked={form.active} onChange={(e) => update({ active: e.target.checked })} /> Visible in shop
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={form.featured} onChange={(e) => update({ featured: e.target.checked })} /> Featured on homepage
              </label>
            </div>
          </div>
          <TextArea label="Description" rows={5} maxLength={4000} value={form.description} onChange={(e) => update({ description: e.target.value })} />
          <TextArea label="Details (one per line)" rows={4} value={form.details} onChange={(e) => update({ details: e.target.value })} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="sub-title">Variants and inventory</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ variants: [...form.variants, blankVariant()] })}>
              <Icon name="plus" size={16} /> Add variant
            </button>
          </div>
          <p className="muted">Variants that have been ordered are never deleted. Untick “Active” to stop selling one.</p>
          <div className="table-wrap">
            <table className="table table-form">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Price (USD)</th>
                  <th>Stock</th>
                  <th>Active</th>
                  <th><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {form.variants.map((v, i) => (
                  <tr key={v.id ?? `new-${i}`}>
                    <td><input aria-label="Variant name" value={v.name} maxLength={80} onChange={(e) => updateVariant(i, { name: e.target.value })} /></td>
                    <td><input aria-label="SKU" value={v.sku} maxLength={60} onChange={(e) => updateVariant(i, { sku: e.target.value.toUpperCase() })} /></td>
                    <td><input aria-label="Price" inputMode="decimal" value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })} /></td>
                    <td><input aria-label="Stock" type="number" min={0} value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} /></td>
                    <td><input aria-label="Active" type="checkbox" checked={v.active} onChange={(e) => updateVariant(i, { active: e.target.checked })} /></td>
                    <td>
                      {!v.id && form.variants.length > 1 && (
                        <button type="button" className="icon-btn" aria-label="Remove variant" onClick={() => update({ variants: form.variants.filter((_, j) => j !== i) })}>
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="sub-title">Images</h2>
            <button type="button" className="btn btn-outline btn-sm" disabled={form.images.length >= 8} onClick={() => update({ images: [...form.images, blankImage()] })}>
              <Icon name="plus" size={16} /> Add image
            </button>
          </div>
          <p className="muted">Use https links to photos you are licensed to use. The first image is the main one.</p>
          <ul className="image-rows">
            {form.images.map((img, i) => (
              <li key={i} className="image-row">
                <span className="image-preview">{img.url.startsWith('https://') ? <img src={sized(img.url, 160)} alt="" /> : <Icon name="image" />}</span>
                <div className="form-grid">
                  <Field label="Image URL" value={img.url} placeholder="https://" error={fe(`images.${i}.url`)} onChange={(e) => updateImage(i, { url: e.target.value })} className="span-2" />
                  <Field label="Alt text" value={img.alt} maxLength={200} error={fe(`images.${i}.alt`)} onChange={(e) => updateImage(i, { alt: e.target.value })} className="span-2" />
                  <Field label="Photographer" value={img.creditName} maxLength={120} onChange={(e) => updateImage(i, { creditName: e.target.value })} />
                  <Field label="Credit link" value={img.creditUrl} error={fe(`images.${i}.creditUrl`)} onChange={(e) => updateImage(i, { creditUrl: e.target.value })} />
                </div>
                <div className="image-row-actions">
                  <button type="button" className="icon-btn" aria-label="Move image up" disabled={i === 0} onClick={() => moveImage(i, -1)}>
                    <Icon name="arrowLeft" size={16} className="rot-90" />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Move image down" disabled={i === form.images.length - 1} onClick={() => moveImage(i, 1)}>
                    <Icon name="arrowRight" size={16} className="rot-90" />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Remove image" onClick={() => update({ images: form.images.filter((_, j) => j !== i) })}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="editor-actions">
          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </button>
          <Link to="/admin/products" className="btn btn-outline">
            Back to products
          </Link>
        </div>
      </form>
    </>
  );
}
