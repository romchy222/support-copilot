import { analyze } from '../../lib/analyze';
import { readJSON, failure, json } from '../../lib/http';
export async function POST(request: Request) { try {
    return json(await analyze(await readJSON(request)));
}
catch (error) {
    return failure(error);
} }
