// ===== Endless Multisender — Main Application Logic =====
// Uses @endlesslab/endless-web3-sdk (embedded web wallet — no extension required)

import { EndlessJsSdk, UserResponseStatus, EndLessSDKEvent } from '@endlesslab/endless-web3-sdk';
import { Network, AccountAddress } from '@endlesslab/endless-ts-sdk';

// ===== CONSTANTS =====
const NETWORKS = {
    mainnet: {
        name: 'Mainnet',
        key: Network.MAINNET,
        rpcUrl: 'https://rpc.endless.link/v1',
        explorerUrl: 'https://explorer.endless.link',
    },
    testnet: {
        name: 'Testnet',
        key: Network.TESTNET,
        rpcUrl: 'https://rpc-test.endless.link/v1',
        explorerUrl: 'https://explorer-test.endless.link',
    },
};

const EDS_DECIMALS = 8;
const EDS_UNIT = 10 ** EDS_DECIMALS; // 1 EDS = 100,000,000 veins

// ===== STATE =====
let state = {
    network: 'mainnet',
    walletAddress: null,
    connected: false,
    recipients: [],
    sending: false,
    sdkReady: false,
};

/** @type {EndlessJsSdk|null} */
let jssdk = null;

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {};

function cacheDom() {
    els.connectBtn = $('#connectBtn');
    els.disconnectBtn = $('#disconnectBtn');
    els.networkBtn = $('#networkBtn');
    els.networkLabel = $('#networkLabel');
    els.networkDropdown = $('#networkDropdown');
    els.walletInfo = $('#walletInfo');
    els.walletAddress = $('#walletAddress');
    els.walletBalance = $('#walletBalance');
    els.recipientInput = $('#recipientInput');
    els.parseBtn = $('#parseBtn');
    els.parseStatus = $('#parseStatus');
    els.uploadBtn = $('#uploadBtn');
    els.csvFile = $('#csvFile');
    els.sampleBtn = $('#sampleBtn');
    els.clearBtn = $('#clearBtn');
    els.tableSection = $('#tableSection');
    els.recipientTableBody = $('#recipientTableBody');
    els.totalRecipients = $('#totalRecipients');
    els.totalAmount = $('#totalAmount');
    els.sendBtn = $('#sendBtn');
    els.sendBtnText = $('#sendBtnText');
    els.progressBar = $('#progressBar');
    els.progressFill = $('#progressFill');
    els.progressText = $('#progressText');
    els.logSection = $('#logSection');
    els.logContent = $('#logContent');
    els.toastContainer = $('#toastContainer');
}

// ===== UTILS =====
function shortAddr(addr) {
    if (!addr) return '';
    return addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
}

function formatEDS(veins) {
    return (Number(veins) / EDS_UNIT).toFixed(4);
}

function parseAmount(amountStr) {
    const n = parseFloat(amountStr);
    if (isNaN(n) || n <= 0) return null;
    return n;
}

function isValidAddress(addr) {
    // Endless addresses can be hex (0x...) or Base58 encoded
    const hexPattern = /^0x[a-fA-F0-9]{1,64}$/;
    const bs58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return hexPattern.test(addr.trim()) || bs58Pattern.test(addr.trim());
}

function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ===== TOAST =====
function showToast(message, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== SDK INITIALIZATION =====
function initSDK() {
    const networkConfig = NETWORKS[state.network];

    jssdk = new EndlessJsSdk({
        network: networkConfig.key,
    });

    // Listen for SDK ready
    jssdk.on(EndLessSDKEvent.INIT, async () => {
        console.log('[Endless] SDK initialized');
        state.sdkReady = true;

        // Try to auto-reconnect
        try {
            const accountRes = await jssdk.getAccount();
            if (accountRes.status === UserResponseStatus.APPROVED) {
                state.walletAddress = accountRes.args.account;
                state.connected = true;
                updateWalletUI();
                fetchBalance();
            }
        } catch (e) {
            // Not connected yet
        }

        // Start auto-balance refresh (every 15s)
        setInterval(() => {
            if (state.connected && !state.sending) {
                fetchBalance();
            }
        }, 15000);
    });
}

// ===== NETWORK =====
function setNetwork(network) {
    if (state.sending) {
        showToast('Cannot switch network while sending', 'error');
        return;
    }

    // Disconnect current wallet if connected
    if (state.connected) {
        disconnectWallet();
    }

    state.network = network;
    els.networkLabel.textContent = NETWORKS[network].name;

    const dot = els.networkBtn.querySelector('.network-dot');
    dot.className = `network-dot ${network === 'testnet' ? 'testnet' : ''}`;

    $$('.network-option').forEach((opt) => {
        opt.classList.toggle('active', opt.dataset.network === network);
    });

    closeDropdown();

    // Re-initialize SDK with new network
    initSDK();

    showToast(`Switched to ${NETWORKS[network].name}`, 'info');
}

function closeDropdown() {
    els.networkDropdown.classList.remove('open');
}

// ===== WALLET =====
async function connectWallet() {
    if (state.connected) return;

    if (!jssdk) {
        showToast('SDK not initialized. Please wait...', 'error');
        return;
    }

    try {
        els.connectBtn.innerHTML = '<span class="spinner"></span><span>Connecting...</span>';
        els.connectBtn.disabled = true;

        const connectRes = await jssdk.connect();

        if (connectRes.status === UserResponseStatus.APPROVED) {
            state.walletAddress = connectRes.args.account;
            state.connected = true;

            updateWalletUI();
            await fetchBalance();
            showToast('Wallet connected successfully!', 'success');
        } else {
            showToast('Connection was rejected', 'error');
            resetConnectBtn();
        }
    } catch (err) {
        console.error('Wallet connect error:', err);
        showToast(`Connection failed: ${err.message || 'Unknown error'}`, 'error');
        resetConnectBtn();
    }
}

async function disconnectWallet() {
    if (!jssdk) return;

    try {
        const disconnectRes = await jssdk.disconnect();
        if (disconnectRes.status === UserResponseStatus.APPROVED) {
            // success
        }
    } catch (e) {
        // Ignore
    }

    state.walletAddress = null;
    state.connected = false;
    updateWalletUI();
    showToast('Wallet disconnected', 'info');
}

function updateWalletUI() {
    if (state.connected && state.walletAddress) {
        els.connectBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>${shortAddr(state.walletAddress)}</span>`;
        els.connectBtn.classList.add('connected');
        els.connectBtn.disabled = true;

        els.walletInfo.classList.remove('hidden');
        els.walletAddress.textContent = shortAddr(state.walletAddress);
        els.walletAddress.title = state.walletAddress;

        updateSendBtn();
    } else {
        resetConnectBtn();
        els.walletInfo.classList.add('hidden');
        els.walletBalance.textContent = '0.00 EDS';
        updateSendBtn();
    }
}

function resetConnectBtn() {
    els.connectBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
      <circle cx="18" cy="16" r="2"/>
    </svg>
    <span>Connect Wallet</span>`;
    els.connectBtn.classList.remove('connected');
    els.connectBtn.disabled = false;
}

async function fetchBalance() {
    if (!state.connected || !state.walletAddress) return;

    try {
        const network = NETWORKS[state.network];

        // Convert Base58 address to hex for REST API if needed
        let apiAddress = state.walletAddress;
        // If the address looks like base58, try to convert using AccountAddress
        if (!apiAddress.startsWith('0x')) {
            try {
                const accAddr = AccountAddress.fromBs58String(apiAddress);
                apiAddress = accAddr.toString();
            } catch (e) {
                // Use as-is
            }
        }

        const url = `${network.rpcUrl}/accounts/${apiAddress}/resources`;
        const res = await fetch(url);

        if (!res.ok) {
            els.walletBalance.textContent = '0.00 EDS';
            return;
        }

        const resources = await res.json();
        let balance = 0;

        for (const r of resources) {
            // Check for CoinStore<EndlessCoin>
            if (r.type && r.type.includes('CoinStore') && r.type.includes('EndlessCoin')) {
                balance = parseInt(r.data?.coin?.value || '0', 10);
                break;
            }
            // Also check for fungible store pattern
            if (r.type && r.type.includes('fungible_asset') && r.data?.balance) {
                balance = parseInt(r.data.balance, 10);
            }
        }

        els.walletBalance.textContent = `${formatEDS(balance)} EDS`;
    } catch (err) {
        console.error('Balance fetch error:', err);
        els.walletBalance.textContent = '— EDS';
    }
}

// ===== CSV PARSER =====
function parseRecipients() {
    const raw = els.recipientInput.value.trim();
    if (!raw) {
        els.parseStatus.textContent = 'Please enter recipient data';
        els.parseStatus.className = 'parse-status error';
        return;
    }

    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];

    lines.forEach((line, i) => {
        const parts = line.split(/[,\s\t]+/).map((p) => p.trim()).filter(Boolean);

        if (parts.length < 2) {
            errors.push(`Line ${i + 1}: Invalid format — need address,amount`);
            return;
        }

        const address = parts[0];
        const amount = parseAmount(parts[1]);

        if (!isValidAddress(address)) {
            errors.push(`Line ${i + 1}: Invalid address "${shortAddr(address)}"`);
            return;
        }
        if (amount === null) {
            errors.push(`Line ${i + 1}: Invalid amount "${parts[1]}"`);
            return;
        }

        parsed.push({
            address,
            amount,
            status: 'pending',
            txHash: null,
        });
    });

    if (errors.length > 0) {
        els.parseStatus.textContent = `${errors.length} error(s): ${errors[0]}`;
        els.parseStatus.className = 'parse-status error';
        showToast(`Found ${errors.length} parsing error(s)`, 'error');
        if (parsed.length === 0) return;
    }

    state.recipients = parsed;
    renderTable();
    els.tableSection.classList.remove('hidden');

    if (errors.length === 0) {
        els.parseStatus.textContent = `✅ ${parsed.length} recipients parsed successfully`;
        els.parseStatus.className = 'parse-status success';
        showToast(`${parsed.length} recipients ready to send`, 'success');
    } else {
        els.parseStatus.textContent = `⚠️ ${parsed.length} valid, ${errors.length} error(s)`;
        els.parseStatus.className = 'parse-status error';
    }

    updateSendBtn();
}

// ===== TABLE =====
function renderTable() {
    const tbody = els.recipientTableBody;
    tbody.innerHTML = '';

    let totalAmt = 0;

    state.recipients.forEach((r, i) => {
        totalAmt += r.amount;

        const tr = document.createElement('tr');
        tr.id = `row-${i}`;
        tr.innerHTML = `
      <td style="color:var(--text-muted); font-weight:500;">${i + 1}</td>
      <td class="address-cell" title="${r.address}">${shortAddr(r.address)}</td>
      <td class="amount-cell">${r.amount.toFixed(4)}</td>
      <td>${statusBadge(r.status, r.txHash)}</td>
    `;
        tbody.appendChild(tr);
    });

    els.totalRecipients.textContent = state.recipients.length;
    els.totalAmount.textContent = totalAmt.toFixed(4);
}

function statusBadge(status, txHash) {
    const labels = {
        pending: '<span class="status-badge status-pending">⏳ Pending</span>',
        sending: '<span class="status-badge status-sending"><span class="spinner"></span> Sending</span>',
        success: '<span class="status-badge status-success">✅ Success</span>',
        error: '<span class="status-badge status-error">❌ Failed</span>',
    };
    let badge = labels[status] || labels.pending;

    if (status === 'success' && txHash) {
        const explorer = NETWORKS[state.network].explorerUrl;
        badge += ` <a href="${explorer}/txn/${txHash}" target="_blank" rel="noopener" style="font-size:0.72rem;color:var(--accent-3);margin-left:4px;">View ↗</a>`;
    }
    return badge;
}

function updateRow(index) {
    const r = state.recipients[index];
    const row = $(`#row-${index}`);
    if (!row) return;
    const statusTd = row.querySelector('td:last-child');
    statusTd.innerHTML = statusBadge(r.status, r.txHash);
}

// ===== SEND =====
function updateSendBtn() {
    const canSend = state.connected && state.recipients.length > 0 && !state.sending;
    els.sendBtn.disabled = !canSend;
}

async function sendAll() {
    if (!state.connected || state.recipients.length === 0 || state.sending) return;
    if (!jssdk) {
        showToast('Wallet SDK not initialized', 'error');
        return;
    }

    state.sending = true;
    els.sendBtn.classList.add('sending');
    els.sendBtnText.textContent = 'Sending Batch...';
    els.progressBar.classList.remove('hidden');
    els.progressText.classList.remove('hidden');
    els.logSection.classList.remove('hidden');
    updateSendBtn();

    const total = state.recipients.length;
    addLog(`Preparing batch send for ${total} recipients (Single Signature)...`, 'info');

    try {
        const addresses = [];
        const amounts = [];

        for (let i = 0; i < total; i++) {
            const recipient = state.recipients[i];
            recipient.status = 'sending';
            updateRow(i);

            // Convert address to hex string
            let hexAddr = recipient.address;
            if (!hexAddr.startsWith('0x')) {
                try {
                    hexAddr = AccountAddress.fromBs58String(hexAddr).toString();
                } catch (e) {
                    // fallback to original
                }
            }

            addresses.push(hexAddr);
            amounts.push(BigInt(Math.round(recipient.amount * EDS_UNIT)).toString());
        }

        // Build batch payload
        const batchData = {
            payload: {
                function: '0x1::endless_account::batch_transfer',
                functionArguments: [addresses, amounts],
            },
        };

        const transactionRes = await jssdk.signAndSubmitTransaction(batchData);

        if (transactionRes.status === UserResponseStatus.APPROVED) {
            const txHash = transactionRes.args?.hash || transactionRes.args?.toString() || '';

            // Mark all as success
            state.recipients.forEach((r, i) => {
                r.status = 'success';
                r.txHash = txHash;
                updateRow(i);
            });

            els.progressFill.style.width = '100%';
            els.progressText.textContent = `Batch sent successfully! ${total}/${total} processed.`;

            addLog(
                `Batch transaction successful! ` +
                (txHash ? `<a href="${NETWORKS[state.network].explorerUrl}/txn/${txHash}" target="_blank">View Transaction ↗</a>` : ''),
                'success'
            );
            showToast(`Batch send complete: ${total} successful`, 'success', 6000);
        } else {
            throw new Error('Transaction rejected by user');
        }
    } catch (err) {
        console.error('Batch transfer error:', err);

        // Mark all as error
        state.recipients.forEach((r, i) => {
            r.status = 'error';
            updateRow(i);
        });

        addLog(`Batch failed: ${err.message || 'Unknown error'}`, 'error');
        showToast(`Batch failed: ${err.message || 'Unknown error'}`, 'error');
    }

    // Done
    state.sending = false;
    els.sendBtn.classList.remove('sending');
    els.sendBtnText.textContent = 'Send All Transactions';
    updateSendBtn();

    // Refresh balance
    await fetchBalance();
}

// ===== LOG =====
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">${timestamp()}</span><span>${message}</span>`;
    els.logContent.appendChild(entry);
    els.logContent.scrollTop = els.logContent.scrollHeight;
}

// ===== SAMPLE & FILE DATA =====
function loadSample() {
    els.recipientInput.value = [
        '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890,1.5',
        '0x9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0,2.0',
        '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789,0.75',
        '0x1111111111111111111111111111111111111111111111111111111111111111,3.25',
        '0x2222222222222222222222222222222222222222222222222222222222222222,1.0',
    ].join('\n');

    showToast('Sample data loaded', 'info');
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        els.recipientInput.value = text;
        showToast('CSV file loaded into editor', 'success');
        parseRecipients(); // Auto-parse after upload
    };
    reader.onerror = () => showToast('Error reading file', 'error');
    reader.readAsText(file);
}

// ===== INIT =====
function init() {
    cacheDom();

    // Connect wallet
    els.connectBtn.addEventListener('click', connectWallet);
    els.disconnectBtn.addEventListener('click', disconnectWallet);

    // Network selector
    els.networkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.networkDropdown.classList.toggle('open');
    });

    $$('.network-option').forEach((opt) => {
        opt.addEventListener('click', () => setNetwork(opt.dataset.network));
    });

    document.addEventListener('click', closeDropdown);

    // Parse & Send
    els.parseBtn.addEventListener('click', parseRecipients);
    els.sendBtn.addEventListener('click', sendAll);

    // Sample & Clear & Upload
    els.sampleBtn.addEventListener('click', loadSample);
    els.uploadBtn.addEventListener('click', () => els.csvFile.click());
    els.csvFile.addEventListener('change', handleFileUpload);
    els.clearBtn.addEventListener('click', () => {
        els.recipientInput.value = '';
        state.recipients = [];
        els.tableSection.classList.add('hidden');
        els.logSection.classList.add('hidden');
        els.parseStatus.textContent = '';
        els.progressBar.classList.add('hidden');
        els.progressText.classList.add('hidden');
        updateSendBtn();
        showToast('Cleared all data', 'info');
    });

    // Ctrl+Enter to parse
    els.recipientInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            parseRecipients();
        }
    });

    // Initialize SDK
    initSDK();
}

document.addEventListener('DOMContentLoaded', init);
