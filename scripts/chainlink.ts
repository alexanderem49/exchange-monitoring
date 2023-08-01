import { ethers } from "hardhat";
import { SwapResult } from "./exchange";

export async function getEthPriceFromChainlink(oracleAddress: string): Promise<SwapResult> {
    const oracle = await ethers.getContractAt("IChainlinkOracle", oracleAddress);

    const price = await oracle.latestAnswer();
    const decimals = await oracle.decimals();

    return {
        amount: price,
        decimals: decimals,
        asString: ethers.utils.formatUnits(price, decimals)
    }
}