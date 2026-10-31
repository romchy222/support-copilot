declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    LLM_API_KEY?: string;
    LLM_MODEL?: string;
    LLM_BASE_URL?: string;
    LLM_EXTERNAL_ENABLED?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_EXTERNAL_ENABLED?: string;
    RAG_ADMIN_TOKEN?: string;
  }
}
