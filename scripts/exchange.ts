import { ethers, network } from "hardhat";
import { BigNumberish, BigNumber, constants } from "ethers";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IExchange } from "../typechain-types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { secrets } from "./aws-secrets";
import { getEthPriceFromChainlink } from "./chainlink";


let signers: SignerWithAddress[];
let exchange: IExchange;
let nativeTokenPriceFeed: string;
const zeroAddr = constants.AddressZero;
const nativeEth = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function testSwap(fromAddress: string, toAddress: string, amount: BigNumberish): Promise<SwapResult> {
    if (fromAddress == zeroAddr || fromAddress == nativeEth) {
        const to = await ethers.getContractAt("IERC20Metadata", toAddress);
        const balBefore = await to.balanceOf(signers[0].address);
        const tx = await (await exchange.exchange(nativeEth, to.address, amount, 0, { value: amount, gasLimit: 30000000 })).wait();
        const amountOut = (await to.balanceOf(signers[0].address)).sub(balBefore);
        const result = { amount: amountOut, decimals: await to.decimals(), asString: formatUnits(amountOut, await to.decimals()) };
        // console.log("Swapped", formatEther(amount),
        //     "ETH for", result,
        //     await to.symbol() + ",", "gas used:", tx.cumulativeGasUsed.toString());
        return result;
    }
    if (toAddress == zeroAddr || toAddress == nativeEth) {
        const from = await ethers.getContractAt("IERC20Metadata", fromAddress);
        await from.approve(exchange.address, amount);
        const balBefore = await signers[0].getBalance();
        const tx = await (await exchange.exchange(from.address, toAddress, amount, 0, { gasLimit: 30000000 })).wait();
        const amountOut = ((await signers[0].getBalance()).add(tx.gasUsed.mul(tx.effectiveGasPrice))).sub(balBefore);
        const result = { amount: amountOut, decimals: 18, asString: formatEther(amountOut) };
        // console.log("Swapped", formatUnits(amount, await from.decimals()),
        //     await from.symbol(), "for", result,
        //     "ETH, gas used:", tx.cumulativeGasUsed.toString());
        return result;
    }

    const from = await ethers.getContractAt("IERC20Metadata", fromAddress);
    await from.approve(exchange.address, amount);
    const to = await ethers.getContractAt("IERC20Metadata", toAddress);
    const balBefore = await to.balanceOf(signers[0].address);
    const tx = await (await exchange.exchange(fromAddress, toAddress, amount, 0, { gasLimit: 30000000 })).wait();
    const amountOut = (await to.balanceOf(signers[0].address)).sub(balBefore);
    const result = { amount: amountOut, decimals: await to.decimals(), asString: formatUnits(amountOut, await to.decimals()) };
    // console.log("Swapped", formatUnits(amount, await from.decimals()),
    //     await from.symbol(), "for", result,
    //     await to.symbol() + ",", "gas used:", tx.cumulativeGasUsed.toString());

    return result;
}

let networkName: string;
let nativeWrappedToken: string;

export async function resetNetwork(_networkName: string) {
    signers = await ethers.getSigners();
    const envVar = _networkName.toUpperCase().replace(" ", "_") + "_URL";
    const url = secrets[envVar];

    if (url == null) {
        throw new Error(`No URL for network ${_networkName}`);
    }

    await network.provider.request({
        method: "hardhat_reset",
        params: [{
            forking: {
                enabled: true,
                jsonRpcUrl: url,
            },
        },],
    });

    switch (_networkName) {
        case "Ethereum":
            exchange = await ethers.getContractAt("IExchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec");
            nativeWrappedToken = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
            nativeTokenPriceFeed = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
            break;
        case "Polygon":
            await setBalance(signers[0].address, parseEther("15000000.0"));
            exchange = await ethers.getContractAt("IExchange", "0xeE0674C1E7d0f64057B6eCFe845DC2519443567F");
            nativeWrappedToken = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
            nativeTokenPriceFeed = "0xab594600376ec9fd91f8e885dadf0ce036862de0";
            break;
        case "Optimism":
            exchange = await ethers.getContractAt("IExchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095");
            nativeWrappedToken = "0x4200000000000000000000000000000000000006";
            nativeTokenPriceFeed = "0x13e3ee699d1909e989722e753853ae30b17e08c5";
            break;

        default:
            throw new Error(`No exchange address known for network ${_networkName}`);
    }

    networkName = _networkName;
}

export type SwapResult = { amount: BigNumber, decimals: number, asString: string } | "Error";

function diff(a: SwapResult, b: SwapResult): SwapResult {
    if (a == "Error" || b == "Error") {
        return "Error";
    }

    const decimals = Math.max(a.decimals, b.decimals);

    const aNormalized = BigNumber.from(a.amount).mul(BigNumber.from(10).pow(decimals - a.decimals));
    const bNormalized = BigNumber.from(b.amount).mul(BigNumber.from(10).pow(decimals - b.decimals));

    return { amount: aNormalized.sub(bNormalized), decimals, asString: formatUnits(aNormalized.sub(bNormalized), decimals) };
}

function div(a: SwapResult, b: SwapResult): SwapResult {
    if (a == "Error" || b == "Error") {
        return "Error";
    }

    return {
        amount: a.amount.mul(BigNumber.from(10).pow(b.decimals)).div(b.amount),
        decimals: a.decimals,
        asString: formatUnits(a.amount.mul(BigNumber.from(10).pow(b.decimals)).div(b.amount), a.decimals)
    }
}

function mul(a: SwapResult, b: SwapResult): SwapResult {
    if (a == "Error" || b == "Error") {
        return "Error";
    }

    const minDecimals = Math.min(a.decimals, b.decimals);
    const maxDecimals = Math.max(a.decimals, b.decimals);
    const result = a.amount.mul(b.amount).div(BigNumber.from(10).pow(minDecimals));

    return {
        amount: result,
        decimals: maxDecimals,
        asString: formatUnits(result, maxDecimals)
    }
}

async function trySwap2Way(tokenAddress: string, amount: BigNumber) {
    let result1: SwapResult;
    try {
        console.log("Trying direct swap");
        result1 = await testSwap(nativeEth, tokenAddress, amount);
    } catch (error) {
        console.log("Error in direct swap:", error);
        result1 = "Error";
    }

    let result2: SwapResult;
    if (result1 != "Error") {
        try {
            console.log("Trying reverse swap");
            const token = await ethers.getContractAt("IERC20Metadata", tokenAddress);
            result2 = await testSwap(tokenAddress, nativeEth, await token.balanceOf(signers[0].address));
        } catch (error) {
            console.log("Error in reverse swap:", error);
            result2 = "Error";
        }
    }
    else {
        result2 = "Error";
    }

    const loss = diff({ amount, decimals: 18, asString: "1.0" }, result2);
    const lossPct = div(loss, { amount, decimals: 18, asString: "1.0" });
    const pricePerToken = div(result1, { amount, decimals: 18, asString: "1.0" });
    const ethPrice = await getEthPriceFromChainlink(nativeTokenPriceFeed);
    const directUsd = div({ amount, decimals: 18, asString: "1.0" }, div(result1, ethPrice));

    return {
        ethPrice,
        directUsd,
        direct: result1,
        reverse: result2,
        loss,
        lossPct,
        pricePerToken,
    };
}

export async function execute2WaySwap(tokenAddress: string) {
    let amount: BigNumberish;

    switch (networkName) {
        case "Polygon":
            amount = parseEther("2500.0");
            break;

        default:
            amount = parseEther("1.0");
            break;
    }
    console.log("Swap amount:", formatEther(amount));

    const timestamp = new Date().toUTCString();

    console.log("Executing 1x swap");
    const result1x = await trySwap2Way(tokenAddress, amount);

    console.log("Executing 10x swap");
    const result10x = await trySwap2Way(tokenAddress, amount.mul(10));

    let routeLength: string;
    try {
        console.log("Checking route length");
        routeLength = (await exchange.buildRoute(nativeWrappedToken, tokenAddress)).length.toString()
    } catch (error) {
        routeLength = "Error";
    }

    let symbol: string;
    try {
        console.log("Getting token symbol");
        const token = await ethers.getContractAt("IERC20Metadata", tokenAddress);
        symbol = await token.symbol()
    } catch (error) {
        symbol = "Error";
    }

    console.log("Resetting network");
    await resetNetwork(networkName);

    return {
        timestamp: timestamp,
        symbol: symbol,
        amount: formatEther(amount),
        result1x: result1x,
        result10x: result10x,
        pricePerTokenDiff: diff(result1x.pricePerToken, result10x.pricePerToken),
        pricePerTokenDiffPct: div(diff(result1x.pricePerToken, result10x.pricePerToken), result1x.pricePerToken),
        routeLength: routeLength
    }
}