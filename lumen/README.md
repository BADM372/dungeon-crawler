# Running the Guide's tutor on NCSA Lumen

Backup setup for BADM 372 (tested 2026-10-15). It runs the tutor on the free
Illinois Lumen gateway (https://lumen.ncsa.illinois.edu) instead of a paid key.

Why a translator is needed: the tutor talks to OpenAI through the Responses API,
and Lumen only offers chat completions. LiteLLM sits in between and converts.

Models (aliased so the tutor's OpenAI model list still works):

- `gpt-6-sol` -> `qwen3.6-35b-a3b`, vision and tools, thinking off (fast). Default.
- `gpt-6-luna` -> `qwen3.8-27b`, vision and tools, thinking on (slower).

The tutor needs vision: its `look_at_game` tool sends screenshots.

## Run it (on one machine)

1. Put your Lumen key in `~/.lumen-api-key` (Lumen profile page, API keys).
2. Make a local proxy key: `python3 -c "import secrets;print('sk-local-'+secrets.token_hex(16))" > ~/.litellm-local-key`
3. Start LiteLLM:

   ```sh
   LITELLM_MASTER_KEY=$(cat ~/.litellm-local-key) LUMEN_KEY=$(cat ~/.lumen-api-key) \
     uvx --from 'litellm[proxy]==1.106.2' litellm --config lumen/litellm.yaml --host 127.0.0.1 --port 4011
   ```

4. Start the game server in a second terminal:

   ```sh
   OPENAI_UPSTREAM=http://127.0.0.1:4011 OPENAI_API_KEY=$(cat ~/.litellm-local-key) \
     LLM_MAX_OUTPUT_TOKENS=8192 uv run --no-project tools/serve.py 8377
   ```

5. Open http://127.0.0.1:8377/learn/ and click Ask.

## Changes to tools/serve.py

- `OPENAI_UPSTREAM` replaces the OpenAI address (default stays api.openai.com).
- `LLM_MAX_OUTPUT_TOKENS` caps `max_output_tokens`. The tutor asks for 128,000
  (the GPT limit), which is more than Lumen's 131k context allows.

Without these variables the server behaves exactly like upstream.
