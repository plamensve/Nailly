"""Nailly visual search. Deploy privately with CPU/GPU and a Supabase service-role key."""
import base64
import io
import os
from functools import lru_cache
from uuid import UUID

import open_clip
import torch
from fastapi import Depends, FastAPI, Header, HTTPException
from contextlib import asynccontextmanager
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from scoring import rank_matches
from indexing import index_missing
from supabase import Client, create_client

MODEL_NAME = 'ViT-B-32-laion2b_s34b_b79k'
MAX_IMAGE_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 24_000_000
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm CLIP and text embeddings once when the container starts. Search requests
    # should never pay model-download/model-init cost.
    model_and_transform()
    nail_text_features()
    yield


app = FastAPI(title='Nailly visual search', lifespan=lifespan)


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

def normalized_image_features(picture: Image.Image):
    model, transform, _ = model_and_transform()
    with torch.inference_mode():
        features = model.encode_image(transform(picture).unsqueeze(0))
        return features / features.norm(dim=-1, keepdim=True)


def nail_confidence_from_features(image_features) -> float:
    with torch.inference_mode():
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
        features = normalized_image_features(picture)
        return features[0].float().tolist()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail='Invalid image') from exc


class ImageQuery(BaseModel):
    image_base64: str = Field(max_length=11_000_000)


ATTRIBUTE_PROMPTS = {
    'shape': {
        'almond': 'a manicure with almond shaped fingernails',
        'square': 'a manicure with square shaped fingernails',
        'round': 'a manicure with round shaped fingernails',
        'oval': 'a manicure with oval shaped fingernails',
        'coffin': 'a manicure with coffin ballerina shaped fingernails',
        'stiletto': 'a manicure with long pointed stiletto fingernails',
        'squoval': 'a manicure with squoval shaped fingernails',
    },
    'length': {
        'short': 'a manicure with short fingernails',
        'medium': 'a manicure with medium length fingernails',
        'long': 'a manicure with long fingernails',
        'extra_long': 'a manicure with extra long fingernails',
    },
    'style': {
        'french': 'a french manicure nail design',
        'ombre': 'an ombre gradient manicure',
        'chrome': 'a chrome metallic manicure',
        'cat_eye': 'a cat eye magnetic nail design',
        'glitter': 'a glitter nail design',
        'minimalist': 'a minimalist nail design',
        'floral': 'a floral flower nail art design',
        'geometric': 'a geometric nail art design',
        'marble': 'a marble nail art design',
        'solid_color': 'a solid single color manicure',
    },
    'finish': {
        'glossy': 'glossy shiny fingernails',
        'matte': 'matte fingernails',
        'chrome': 'chrome mirror finish fingernails',
        'glitter': 'glitter finish fingernails',
    },
    'color': {
        'nude': 'nude beige manicure',
        'white': 'white manicure',
        'pink': 'pink manicure',
        'red': 'red manicure',
        'black': 'black manicure',
        'blue': 'blue manicure',
        'green': 'green manicure',
        'purple': 'purple manicure',
        'brown': 'brown manicure',
        'gold': 'gold manicure',
        'silver': 'silver manicure',
        'multicolor': 'multicolor manicure with several colors',
    },
}


@lru_cache(maxsize=1)
def attribute_text_features():
    model, _, tokenizer = model_and_transform()
    result = {}
    with torch.inference_mode():
        for group, prompts in ATTRIBUTE_PROMPTS.items():
            labels = list(prompts.keys())
            features = model.encode_text(tokenizer(list(prompts.values())))
            features = features / features.norm(dim=-1, keepdim=True)
            result[group] = (labels, features)
    return result


def detect_attributes(image_features):
    detected = {}
    with torch.inference_mode():
        for group, (labels, features) in attribute_text_features().items():
            probs = (100.0 * image_features @ features.T).softmax(dim=-1)[0]
            if group == 'color':
                order = torch.argsort(probs, descending=True)[:2].tolist()
                colors = [{'value': labels[i], 'confidence': round(float(probs[i].item()), 3)} for i in order]
                detected['colors'] = colors
            else:
                i = int(torch.argmax(probs).item())
                detected[group] = {'value': labels[i], 'confidence': round(float(probs[i].item()), 3)}
    return detected


def decode_query_image(query: ImageQuery):
    try:
        raw = base64.b64decode(query.image_base64, validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail='Invalid base64') from exc
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail='Image must be at most 8 MB')
    try:
        return ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail='Invalid image') from exc


@app.post('/analyze')
def analyze(query: ImageQuery, user_id: str = Depends(authenticated_user)):
    picture = decode_query_image(query)
    image_features = normalized_image_features(picture)
    confidence = nail_confidence_from_features(image_features)
    if confidence < 0.55:
        raise HTTPException(status_code=422, detail='This photo does not look like a manicure or nail design. Choose a clear close-up photo of nails.')
    return {'attributes': detect_attributes(image_features), 'nail_confidence': round(confidence, 3), 'model': MODEL_NAME}


@app.post('/search')
def search(query: ImageQuery, user_id: str = Depends(authenticated_user)):
    picture = decode_query_image(query)
    # Encode the query only once. Previously /search ran CLIP twice (validation +
    # embedding), which made CPU cold starts much more likely to exceed mobile timeouts.
    image_features = normalized_image_features(picture)
    confidence = nail_confidence_from_features(image_features)
    if confidence < 0.55:
        raise HTTPException(status_code=422, detail='This photo does not look like a manicure or nail design. Choose a clear close-up photo of nails.')
    embedding = image_features[0].float().tolist()
    db = database()
    params = {'query_embedding': embedding, 'result_limit': 30}
    result = db.rpc('match_nail_looks', params).execute()
    # Never index portfolio photos inside a user search. Indexing downloads images
    # and runs CLIP once per missing look, so doing it here can turn one search into
    # minutes of CPU work and guarantees mobile timeouts on an empty index.
    matches = rank_matches(result.data or [])
    if not matches:
        raise HTTPException(status_code=503, detail='No indexed studio photos are available yet. Re-index the studio portfolio, then retry the search.')
    return {'results': matches, 'model': MODEL_NAME, 'score_type': 'calibrated_visual_match', 'nail_confidence': round(confidence, 3)}


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
