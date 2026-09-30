# Nailly matching service — production

The matching service is a private Python/FastAPI service that generates OpenCLIP
embeddings and queries Nailly's Supabase/pgvector index.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `PORT` (defaults to `8000`)

Never put the service-role key in Expo, a client-side `.env`, Dockerfile, GitHub,
or a public container image.

## Local Docker smoke test

From `matching_service`:

```bash
docker build --progress=plain -t nailly-matching .
docker run --rm -p 8000:8000 \
  -e SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY" \
  nailly-matching
```

Then open `http://localhost:8000/health`. Expected response:

```json
{"ok":true}
```

## CPU-only production image

The Docker image intentionally installs PyTorch and torchvision from the official
CPU wheel index before installing the remaining dependencies. This prevents pip
from downloading the large CUDA/NVIDIA runtime packages, which are unnecessary
for the CPU-only AWS Lightsail container service.

If a future deployment moves to a GPU runtime, use a separate GPU-specific image
rather than changing this production CPU image.

## AWS Lightsail container service

Deploy this folder as a Linux Docker image. Configure the container's HTTP port as
`8000` and public endpoint health check path as `/health`.

Set the required environment variables in the Lightsail deployment configuration;
do not bake them into the image.

Lightsail provides an HTTPS default endpoint. Once deployed, set the production
mobile app variable to that HTTPS endpoint:

```env
EXPO_PUBLIC_MATCH_API_URL=https://YOUR_LIGHTSAIL_ENDPOINT
```

A custom domain such as `match.nailly.app` can be attached later.

### Capacity

OpenCLIP/PyTorch is substantially heavier than a typical FastAPI service. Start
with one node and enough RAM for the model, then measure memory, CPU, and search
latency before resizing. Keep `--workers 1`: every additional worker can load
another model copy and materially increase RAM usage.

## Production checks

- `GET /health` returns HTTP 200.
- A signed-in Nailly user can call `POST /search`.
- An unauthenticated `POST /search` returns 401.
- New studio portfolio uploads can be indexed.
- Supabase service-role key exists only in server-side configuration.
- Production Expo build points only to the HTTPS endpoint.
