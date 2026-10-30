declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_EXTERNAL_ENABLED?: string;
    RAG_ADMIN_TOKEN?: string;
  }
}
