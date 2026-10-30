import { predict } from './batch.mjs';
try {
    const result = await predict(...process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.errors)
        process.exitCode = 1;
}
catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
