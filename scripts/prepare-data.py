"""Extract only the selected case into an ignored private directory."""
import json, pathlib, tarfile, sys
archive = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '../Данные/grand-support-copilot-handout-2026-10-27.tgz')
destination = pathlib.Path('.private')
destination.mkdir(exist_ok=True)
with tarfile.open(archive) as bundle:
    rules=json.load(bundle.extractfile('handout/rules.json'))
    taxonomy=json.load(bundle.extractfile('handout/taxonomy.json'))
    (destination/'corpus.json').write_text(json.dumps({'rules':rules,'taxonomy':taxonomy},ensure_ascii=False),encoding='utf8')
    (destination/'tickets_valid.jsonl').write_bytes(bundle.extractfile('handout/tickets_valid.jsonl').read())
print('Private corpus and validation data prepared. No training tickets copied.')
