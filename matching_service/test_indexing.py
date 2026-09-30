import unittest
from types import SimpleNamespace
from indexing import index_missing


class Query:
    def __init__(self, db, table):
        self.db, self.table_name, self.payload = db, table, None
    def select(self, *args): return self
    def eq(self, *args): return self
    def order(self, *args): return self
    def range(self, *args): return self
    def in_(self, *args): return self
    def upsert(self, payload):
        self.payload = payload
        return self
    def execute(self):
        if self.payload:
            self.db.writes.append(self.payload)
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=self.db.rows if self.table_name == 'portfolio_looks' else self.db.existing)


class Database:
    def __init__(self, rows, existing=()):
        self.rows, self.existing, self.writes = rows, list(existing), []
        self.storage = self
        self.downloads = []
    def table(self, name): return Query(self, name)
    def from_(self, name): return self
    def download(self, path):
        self.downloads.append(path)
        if path.endswith('broken.jpg'): raise OSError('broken image')
        return path.encode()


class IndexTests(unittest.TestCase):
    def test_existing_photo_is_skipped_and_missing_photo_embedded(self):
        db = Database([{'id':'a','studio_id':'s','storage_path':'s/a.jpg'}, {'id':'b','studio_id':'s','storage_path':'s/b.jpg'}], [{'look_id':'a'}])
        self.assertEqual(index_missing(db, lambda raw: [1.0, 0.0], 'model'), {'indexed':1,'failed':0})
        self.assertEqual(db.downloads, ['s/b.jpg'])
        self.assertEqual(db.writes[0]['look_id'], 'b')
        self.assertEqual(db.writes[0]['embedding'], [1.0, 0.0])

    def test_broken_or_cross_studio_photo_cannot_block_valid_photo(self):
        db = Database([{'id':'a','studio_id':'s','storage_path':'other/a.jpg'}, {'id':'b','studio_id':'s','storage_path':'s/broken.jpg'}, {'id':'c','studio_id':'s','storage_path':'s/c.jpg'}])
        self.assertEqual(index_missing(db, lambda raw: [1], 'model'), {'indexed':1,'failed':2})
        self.assertEqual(db.downloads, ['s/broken.jpg', 's/c.jpg'])

    def test_work_is_bounded(self):
        db = Database([{'id':str(i),'studio_id':'s','storage_path':f's/{i}.jpg'} for i in range(10)])
        self.assertEqual(index_missing(db, lambda raw: [1], 'model', limit=2)['indexed'], 2)
        self.assertEqual(len(db.downloads), 2)
