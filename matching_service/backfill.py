"""Index existing published portfolio images after deploying the matching service.

Run only in a trusted backend environment with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
"""
from app import MODEL_NAME, database, image_embedding


def main():
    db = database()
    offset = 0
    while True:
        rows = db.table('portfolio_looks').select('id,storage_path,published').eq('published', True).range(offset, offset + 99).execute().data or []
        for row in rows:
            if not row['storage_path']:
                continue
            raw = db.storage.from_('portfolio').download(row['storage_path'])
            db.table('look_embeddings').upsert({
                'look_id': row['id'], 'embedding': image_embedding(raw), 'model': MODEL_NAME,
            }).execute()
            print(f"Indexed {row['id']}")
        if len(rows) < 100:
            break
        offset += 100


if __name__ == '__main__':
    main()
