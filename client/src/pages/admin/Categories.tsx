import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ErrorState, Field, Notice, Spinner } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { sized } from '../../lib/format';
import type { Category } from '../../lib/types';
import { useApi } from '../../lib/useApi';

type AdminCategory = Category & { position: number; active: boolean };
type Draft = { id?: number; slug: string; name: string; description: string; imageUrl: string; imageAlt: string; position: string; active: boolean };

const blank: Draft = { slug: '', name: '', description: '', imageUrl: '', imageAlt: '', position: '0', active: true };

export function AdminCategories() {
  const { data, error, loading, reload } = useApi<{ categories: AdminCategory[] }>('/admin/categories');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);

  if (loading) return <Spinner label="Loading categories" />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const edit = (c: AdminCategory) =>
    setDraft({ id: c.id, slug: c.slug, name: c.name, description: c.description, imageUrl: c.imageUrl ?? '', imageAlt: c.imageAlt, position: String(c.position), active: c.active });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    const body = {
      slug: draft.slug,
      name: draft.name,
      description: draft.description,
      imageUrl: draft.imageUrl.trim() || null,
      imageAlt: draft.imageAlt,
      position: Number.parseInt(draft.position, 10) || 0,
      active: draft.active,
    };
    try {
      await api(draft.id ? `/admin/categories/${draft.id}` : '/admin/categories', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save'));
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d!, [k]: e.target.value }));

  return (
    <>
      <header className="page-head page-head-row">
        <h1 className="page-title">Categories</h1>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => setDraft({ ...blank })}>
          <Icon name="plus" size={16} /> New category
        </button>
      </header>

      {draft && (
        <form className="panel" onSubmit={onSubmit} noValidate>
          <h2 className="sub-title">{draft.id ? `Edit ${draft.name}` : 'New category'}</h2>
          {formError && <Notice tone="error">{formError.message}</Notice>}
          <div className="form-grid">
            <Field label="Name" value={draft.name} onChange={set('name')} required maxLength={80} error={formError?.fieldMessage('name')} />
            <Field label="Slug" value={draft.slug} onChange={set('slug')} required maxLength={80} error={formError?.fieldMessage('slug')} />
            <Field label="Description" value={draft.description} onChange={set('description')} maxLength={500} className="span-2" />
            <Field label="Image URL" value={draft.imageUrl} onChange={set('imageUrl')} placeholder="https://" error={formError?.fieldMessage('imageUrl')} className="span-2" />
            <Field label="Image alt text" value={draft.imageAlt} onChange={set('imageAlt')} maxLength={200} />
            <Field label="Sort position" type="number" min={0} value={draft.position} onChange={set('position')} />
            <label className="checkbox">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Visible in shop
            </label>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-dark btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save category'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Slug</th>
              <th className="num">Products</th>
              <th className="num">Position</th>
              <th>Status</th>
              <th><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'is-muted'}>
                <td>
                  <span className="table-product">
                    {c.imageUrl ? <img src={sized(c.imageUrl, 80)} alt="" /> : <span className="thumb-empty" />}
                    <span>{c.name}</span>
                  </span>
                </td>
                <td>{c.slug}</td>
                <td className="num">{c.productCount}</td>
                <td className="num">{c.position}</td>
                <td>{c.active ? 'Visible' : 'Hidden'}</td>
                <td>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => edit(c)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
