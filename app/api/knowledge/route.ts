import {getIndex} from '../../../lib/corpus-store';
import {retrieve} from '../../../lib/rag.mjs';
export async function GET(request:Request){const index=await getIndex();if(!index)return Response.json({loaded:false,documents:0,sources:[]});const q=new URL(request.url).searchParams.get('q')?.slice(0,1000)||'';const sources=q?retrieve(index,q,12):index.corpus.documents.slice(0,6);return Response.json({loaded:true,documents:index.docs.length,sections:index.corpus.sections,sources},{headers:{'Cache-Control':'private, max-age=30'}})}
