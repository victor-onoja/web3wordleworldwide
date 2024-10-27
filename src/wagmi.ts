import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
  arbitrumSepolia,
} from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "web3wordleworldwide",
  projectId: "9007a837d39430d76cc3318784653595",
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    arbitrumSepolia,
    base,
    sepolia,
  ],
});
