import { loadAwsSecrets } from "./aws-secrets";
import { execute2WaySwap, resetNetwork } from "./exchange";
import { addDataToSheet, getTokens, initGoogleApi } from "./google-sheets";

async function main() {
    console.log("Loading secrets...");
    await loadAwsSecrets();
    console.log("Init Google API...");
    await initGoogleApi();

    console.log("Reading tokens list...")
    const tokens = await getTokens();
    console.log("Networks loaded:", tokens.length);

    for (let i = 0; i < tokens.length; i++) {
        console.log("Processing network", tokens[i].network);
        const tokenList = tokens[i];

        console.log("Tokens amount: ", tokenList.tokensAddresses.length);

        if (tokenList.tokensAddresses.length == 0) {
            console.log("Skipping empty network");
            continue;
        }

        console.log(`Resetting to ${tokenList.network}...`);
        await resetNetwork(tokenList.network);
        console.log("Reset done");

        let data: any[][] = [];

        for (let j = 0; j < tokenList.tokensAddresses.length; j++) {
            const token = tokenList.tokensAddresses[j];

            console.log("Processing token", j, "of", tokenList.tokensAddresses.length, ":", token);
            const result = await execute2WaySwap(token);
            console.log("Received results for", result.symbol);

            console.log(result);

            data.push([
                result.timestamp,
                result.symbol,
                result.amount,
                result.result1x.ethPrice == "Error" ? "Error" : result.result1x.ethPrice.asString,
                result.result1x.directUsd == "Error" ? "Error" : result.result1x.directUsd.asString,
                result.result1x.direct == "Error" ? "Error" : result.result1x.direct.asString,
                result.result1x.reverse == "Error" ? "Error" : result.result1x.reverse.asString,
                result.result1x.loss == "Error" ? "Error" : result.result1x.loss.asString,
                result.result1x.lossPct == "Error" ? "Error" : parseFloat(result.result1x.lossPct.asString) * 100,
                result.result1x.pricePerToken == "Error" ? "Error" : result.result1x.pricePerToken.asString,
                result.result10x.direct == "Error" ? "Error" : result.result10x.direct.asString,
                result.result10x.reverse == "Error" ? "Error" : result.result10x.reverse.asString,
                result.result10x.loss == "Error" ? "Error" : result.result10x.loss.asString,
                result.result10x.lossPct == "Error" ? "Error" : parseFloat(result.result10x.lossPct.asString) * 100,
                result.result10x.pricePerToken == "Error" ? "Error" : result.result10x.pricePerToken.asString,
                result.pricePerTokenDiff == "Error" ? "Error" : result.pricePerTokenDiff.asString,
                result.pricePerTokenDiffPct == "Error" ? "Error" : parseFloat(result.pricePerTokenDiffPct.asString) * 100,
                result.routeLength
            ]);
        }

        console.log("Writing data to sheet...");
        await addDataToSheet(tokenList.network, data);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});