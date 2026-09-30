"""Nailly visual search. Deploy privately with CPU/GPU and a Supabase service-role key."""
import base64
import io
import os
from functools import lru_cache
from uuid import UUID

import open_clip
import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from scoring import rank_matches
from indexing import index_missing
from supabase import Client, create_client

MODEL_NAME = 'ViT-B-32-laion2b_s34b_b79k'
MAX_IMAGE_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000
app = FastAPI(title='Nailly visual search')


@lru_cache(maxsize=1)
def database() -> Client:
    return create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])


@lru_cache(maxsize=1)
def model_and_transform():
    model, _, transform = open_clip.create_model_and_transforms(
        'ViT-B-32', pretrained='laion2b_s34b_b79k', device='cpu'
    )
    tokenizer = open_clip.get_tokenizer('ViT-B-32')
    model.eval()
    return model, transform, tokenizer

@lru_cache(maxsize=1)
def nail_text_features():
    model, _, tokenizer = model_and_transform()
    labels = [
        'a close-up photo of manicured fingernails with nail art',
        'a photo of a manicure on a human hand',
        'a close-up photo of painted fingernails',
        'a photo of something unrelated to fingernails or manicure',
    ]
    with torch.inference_mode():
        features = model.encode_text(tokenizer(labels))
        features = features / features.norm(dim=-1, keepdim=True)
    return features

def nail_confidence(picture: Image.Image) -> float:
    model, transform, _ = model_and_transform()
    with torch.inference_mode():
        image_features = model.encode_image(transform(picture).unsqueeze(0))
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        logits = (100.0 * image_features @ nail_text_features().T).softmax(dim=-1)[0]
    # First three prompts are nail/manicure concepts; the final prompt is the negative class.
    return float(logits[:3].sum().item())


def authenticated_user(authorization: str = Header(default='')) -> str:
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Sign in required')
    try:
        response = database().auth.get_user(authorization[7:])
        if not response.user:
            raise ValueError('No user')
        return response.user.id
    except Exception as exc:
        raise HTTPException(status_code=401, detail='Invalid session') from exc


def image_embedding(raw: bytes) -> list[float]:
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail='Image must be at most 8 MB')
    try:
        picture = Image.open(io.BytesIO(raw))
        picture.verify()
        picture = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
        model, transform, _ = model_and_transform()
        with torch.inference_mode():
            features = model.encode_image(transform(picture).unsqueeze(0))
            features = features / features.norm(dim=-1, keepdim=True)
        return features[0].float().tolist()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail='Invalid image') from exc


class ImageQuery(BaseModel):
    image_base64: str = Field(max_length=11_000_000)


@app.post('/search')
def search(query: ImageQuery, user_id: str = Depends(authenticated_user)):
    try:
        raw = base64.b64decode(query.image_base64, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='Invalid base64') from exc
    try:
        picture = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail='Invalid image') from exc
    confidence = nail_confidence(picture)
    if confidence < 0.55:
        raise HTTPException(status_code=422, detail='This photo does not look like a manicure or nail design. Choose a clear close-up photo of nails.')
    embedding = image_embedding(raw)
    db = database()
    params = {'query_embedding': embedding, 'result_limit': 30}
    result = db.rpc('match_nail_looks', params).execute()
    repaired = {'indexed': 0, 'failed': 0}
    if not result.data:
        # Repair an empty index on first search, without rescanning a large gallery
        # on every subsequent query. Normal uploads index through /index.
        repaired = index_missing(db, image_embedding, MODEL_NAME)
        result = db.rpc('match_nail_looks', params).execute()
    matches = rank_matches(result.data or [])
    if not matches:
        raise HTTPException(status_code=503, detail='No indexed studio photos are available. The matching server must finish portfolio indexing before photo search can return results.')
    return {'results': matches, 'model': MODEL_NAME, 'score_type': 'calibrated_visual_match', 'nail_confidence': round(confidence, 3), 'indexing': repaired}


@app.post('/index/{look_id}')
def index_look(look_id: UUID, user_id: str = Depends(authenticated_user)):
    result = database().table('portfolio_looks').select('id,studio_id,storage_path,studios(owner_id)').eq('id', str(look_id)).single().execute()
    look = result.data
    if not look or not look['studios'] or look['studios']['owner_id'] != user_id:
        raise HTTPException(status_code=403, detail='Only the studio owner can index this photo')
    path = look['storage_path']
    if not path or not path.startswith(f"{look['studio_id']}/"):
        raise HTTPException(status_code=400, detail='Photo must be in portfolio storage')
    raw = database().storage.from_('portfolio').download(path)
    embedding = image_embedding(raw)
    database().table('look_embeddings').upsert({
        'look_id': str(look_id), 'embedding': embedding, 'model': MODEL_NAME,
    }).execute()
    return {'indexed': str(look_id)}


@app.get('/health')
def health():
    return {'ok': True}
