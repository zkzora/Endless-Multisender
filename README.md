# Endless ($EDS) Multisender

A premium, simple, and efficient multisender website for the Endless ($EDS) blockchain. Send tokens to multiple addresses in one batch transaction using the official Endless Web3 SDK.

## Features

- **Endless Web3 SDK Integration**: Built with the latest @endlesslab/endless-web3-sdk for seamless embedded wallet connectivity.
- **Embedded Web Wallet**: No browser extension required. A secure popup/iframe wallet handles everything.
- **Batch Transfer**: Input multiple addresses and amounts at once.
- **CSV Import**: Import your recipient list directly from a CSV file.
- **Auto-Refresh Balance**: Live EDS balance updates every 15 seconds.
- **Premium Dark UI**: Modern design with glassmorphism and smooth animations.
- **Network Selector**: Toggle between Mainnet and Testnet.
- **Transaction Logs**: Real-time progress tracking with explorer links.

## Technology Stack

- **Framework**: [Vite](https://vitejs.dev/) (Vanilla JS)
- **Styling**: Vanilla CSS (Custom dark theme)
- **SDK**: [@endlesslab/endless-web3-sdk](https://www.npmjs.com/package/@endlesslab/endless-web3-sdk) & [@endlesslab/endless-ts-sdk](https://www.npmjs.com/package/@endlesslab/endless-ts-sdk)
- **Deployment**: Optimized for [Vercel](https://vercel.com/)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/zkzora/Endless
   cd Endless
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## CSV Format

To import recipients via CSV, use the following simple format:

```csv
address,amount
0x1a2b3c4d5e6f...,1.5
0x9f8e7d6c5b4a...,2.0
```

## Deployment

This project is ready to be deployed on Vercel.

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. Follow the prompts to deploy.

## Credits

Build by **zkzora** — Follow on [X.com/zk_zora](https://x.com/zk_zora)
Repository: [github.com/zkzora](https://github.com/zkzora)
Powered by **Endless Ecosystem ($EDS)**

---

*Disclaimer: This tool is provided as-is. Always double-check addresses and amounts before confirming transactions.*
