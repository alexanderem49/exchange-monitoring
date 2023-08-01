import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export let secrets: any;

export async function loadAwsSecrets() {
    const secret_name = "exchange-monitoring-secrets-2";

    const client = new SecretsManagerClient({
        region: process.env.EXCHANGE_MONITORING_ECR_REGION,
    });

    let response;

    try {
        response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name,
                VersionStage: "AWSCURRENT",
            })
        );
    } catch (error) {
        if (process.env.AWS_SECRETS) {
            secrets = JSON.parse(process.env.AWS_SECRETS);
            return;
        }

        console.log("Error loading secrets, using env variables");
        secrets = process.env;
        return;
    }

    if (response.SecretString === undefined) {
        throw new Error("No secret string found");
    }

    secrets = JSON.parse(response.SecretString);
}