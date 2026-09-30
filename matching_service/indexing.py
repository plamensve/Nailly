"""Repair missing portfolio vectors before querying; never index arbitrary URLs."""
from datetime import datetime, timezone


def index_missing(db, embed, model, limit=20):
    indexed = 0
    failures = 0
    offset = 0
    while indexed + failures < limit:
        rows = db.table('portfolio_looks').select('id,studio_id,storage_path').eq('published', True).order('id').range(offset, offset + 99).execute().data or []
        if not rows:
            break
        existing = db.table('look_embeddings').select('look_id').eq('model', model).in_('look_id', [row['id'] for row in rows]).execute().data or []
        known = {row['look_id'] for row in existing}
        for row in rows:
            if row['id'] in known:
                continue
            if indexed + failures >= limit:
                break
            path = row['storage_path']
            if not path or not path.startswith(f"{row['studio_id']}/"):
                failures += 1
                continue
            try:
                raw = db.storage.from_('portfolio').download(path)
                db.table('look_embeddings').upsert({
                    'look_id': row['id'], 'embedding': embed(raw), 'model': model,
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                }).execute()
                indexed += 1
            except Exception:
                # A broken portfolio image must not prevent other designs matching.
                failures += 1
        if len(rows) < 100:
            break
        offset += 100
    return {'indexed': indexed, 'failed': failures}
