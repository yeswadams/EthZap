import { Eip1193Provider } from "ethers";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      request: (request: {
        method: string;
        params?: Array<any>;
      }) => Promise<any>;
    };
  }
}

export {};
