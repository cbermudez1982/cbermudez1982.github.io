import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js';

/**
 * @title SimpleSwap DEX Interface
 * @notice A decentralized exchange interface for token swaps and liquidity provision
 * @dev Interacts with Ethereum smart contracts using ethers.js library
 */
const provider = new ethers.BrowserProvider(window.ethereum);
let signer;

/// @notice Address of the deployed Swap contract
const CONTRACT_ADDRESS = "0xe30Ad4daFB933547Fe3e68ea4e3dB8416CDEEf82";

/// @notice Address of Token A contract
const TOKEN_A = "0xf367150C56b9c8C14db60914C82D1b278cfA7A6D";

/// @notice Address of Token B contract
const TOKEN_B = "0x1Fd59a58510686a2d6029A8D27F66Fdc68360ed1";

/**
 * @notice ABI for ERC20 token contracts
 * @dev Includes balanceOf, mint, and approve functions
 */
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint)",
  "function mint(address to, uint amount)",
  "function approve(address, uint) returns (bool)"
];

/**
 * @notice ABI for Swap contract
 * @dev Includes functions for liquidity management and token swaps
 */
const SWAP_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] memory)",
  "function getPrice(address tokenA, address tokenB) external view returns (uint256 price)",
  "function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)",
  "function balanceOf(address account) external view returns (uint256)"
];

// UI Elements
const connectBtn = document.getElementById("connectBtn");
const walletAddress = document.getElementById("walletAddress");
const addLiqBtn = document.getElementById("addLiqBtn");
const swapBtn = document.getElementById("swapBtn");
const remLiqBtn = document.getElementById("remLiqBtn");
const liqStatus = document.getElementById("liqStatus");
const swapStatus = document.getElementById("swapStatus");
const remLiqStatus = document.getElementById("remLiqStatus");
const swapOrderBtn = document.getElementById("swapOrderBtn");
const priceDisplay = document.getElementById("priceDisplay");
const liqDisplay = document.getElementById("liqDisplay");
const tokenADisplay = document.getElementById("tokenA");
const tokenBDisplay = document.getElementById("tokenB");
const mintStatus = document.getElementById("mintStatus");

/// @notice Currently selected token pair (A and B)
let currentTokenA = TOKEN_A;
let currentTokenB = TOKEN_B;

/**
 * @notice Gets the Swap contract instance
 * @dev Uses the current signer or gets a new one if not available
 * @return {Promise<ethers.Contract>} Instance of the Swap contract
 */
async function getSwapContract() {
  signer = signer || await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, SWAP_ABI, signer);
}

/**
 * @notice Gets a Token contract instance
 * @dev Uses the current signer or gets a new one if not available
 * @param {string} tokenAddress Address of the token contract
 * @return {Promise<ethers.Contract>} Instance of the Token contract
 */
async function getTokenContract(tokenAddress) {
  signer = signer || await provider.getSigner();
  return new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
}

/**
 * @notice Updates the UI with current contract state
 * @dev Fetches and displays token prices, liquidity, and balances
 * @return {Promise<void>}
 */
async function updateUI() {
  if (!signer) {
    priceDisplay.innerText = "-";
    liqDisplay.innerText = "-";
    return;
  }

  try {
    const contract = await getSwapContract();
    const address = await signer.getAddress();
    
    const [price, liquidity] = await Promise.all([
      contract.getPrice(currentTokenA, currentTokenB),
      contract.balanceOf(address)
    ]);

    priceDisplay.innerText = ethers.formatUnits(price, 18);
    liqDisplay.innerText = ethers.formatUnits(liquidity, 18);
    
    tokenADisplay.innerText = `${currentTokenA.slice(0, 6)}...${currentTokenA.slice(-4)}`;
    tokenBDisplay.innerText = `${currentTokenB.slice(0, 6)}...${currentTokenB.slice(-4)}`;
  } catch (e) {
    console.error("Error updating UI:", e);
    priceDisplay.innerText = "-";
    liqDisplay.innerText = "-";
  }
}

/**
 * @notice Executes a token swap
 * @dev Handles token approval and swap transaction
 * @return {Promise<void>}
 */
async function swapTokens() {
  if (!signer) {
    alert("Connect your wallet first.");
    return;
  }

  swapStatus.textContent = "Initializing swap...";
  
  try {
    const amountIn = document.getElementById("swapAmountIn").value;
    if (!amountIn || Number(amountIn) <= 0) {
      throw new Error("Enter a valid amount.");
    }

    const contract = await getSwapContract();
    const tokenIn = await getTokenContract(currentTokenA);
    const amountInWei = ethers.parseUnits(amountIn, 18);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const address = await signer.getAddress();

    swapStatus.textContent = "Approving tokens...";
    const approveTx = await tokenIn.approve(CONTRACT_ADDRESS, amountInWei);
    await approveTx.wait();

    swapStatus.textContent = "Making swap...";
    const swapTx = await contract.swapExactTokensForTokens(
      amountInWei,
      0,
      [currentTokenA, currentTokenB],
      address,
      deadline
    );
    await swapTx.wait();

    swapStatus.textContent = "✅ Swap Completed!";
    await updateUI();
  } catch (e) {
    console.error("Swap error:", e);
    swapStatus.textContent = `❌ Error: ${e.reason || e.message || e}`;
  }
}

/**
 * @notice Swaps the order of tokens in the current pair
 * @dev Updates UI after swapping token references
 */
function swapTokenOrder() {
  [currentTokenA, currentTokenB] = [currentTokenB, currentTokenA];
  updateUI();
}

/**
 * @notice Adds liquidity to the pool
 * @dev Handles token approvals and liquidity provision
 * @return {Promise<void>}
 */
async function addLiquidity() {
  if (!signer) {
    alert("Connect your wallet first.");
    return;
  }

  liqStatus.textContent = "Initializing...";
  
  try {
    const amountA = document.getElementById("liqAmountA").value;
    const amountB = document.getElementById("liqAmountB").value;
    
    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
      throw new Error("Invalid amounts.");
    }

    const contract = await getSwapContract();
    const tokenA = await getTokenContract(currentTokenA);
    const tokenB = await getTokenContract(currentTokenB);
    const amountAWei = ethers.parseUnits(amountA, 18);
    const amountBWei = ethers.parseUnits(amountB, 18);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const address = await signer.getAddress();

    liqStatus.textContent = "Approving Token A...";
    const approveA = await tokenA.approve(CONTRACT_ADDRESS, amountAWei);
    
    liqStatus.textContent = "Approving Token B...";
    const approveB = await tokenB.approve(CONTRACT_ADDRESS, amountBWei);
    
    await Promise.all([approveA.wait(), approveB.wait()]);

    liqStatus.textContent = "Adding Liquidity...";
    const tx = await contract.addLiquidity(
      currentTokenA,
      currentTokenB,
      amountAWei,
      amountBWei,
      0,
      0,
      address,
      deadline
    );
    await tx.wait();

    liqStatus.textContent = "✅ Liquidity Added!";
    await updateUI();
  } catch (e) {
    console.error("Add liquidity error:", e);
    liqStatus.textContent = `❌ Error: ${e.reason || e.message || e}`;
  }
}

/**
 * @notice Removes liquidity from the pool
 * @dev Handles LP token approval and liquidity removal
 * @return {Promise<void>}
 */
async function removeLiquidity() {
  if (!signer) {
    alert("Connect your wallet first.");
    return;
  }

  remLiqStatus.textContent = "Initializing...";
  
  try {
    const amountLP = document.getElementById("liqAmountRemove").value;
    if (!amountLP || Number(amountLP) <= 0) {
      throw new Error("Invalid Amount");
    }

    const contract = await getSwapContract();
    const lpToken = await getTokenContract(CONTRACT_ADDRESS);
    const amountLPWei = ethers.parseUnits(amountLP, 18);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const address = await signer.getAddress();

    remLiqStatus.textContent = "Approving LP tokens...";
    const approveTx = await lpToken.approve(CONTRACT_ADDRESS, amountLPWei);
    await approveTx.wait();

    remLiqStatus.textContent = "Removing LP Tokens...";
    const tx = await contract.removeLiquidity(
      currentTokenA,
      currentTokenB,
      amountLPWei,
      0,
      0,
      address,
      deadline
    );
    await tx.wait();

    remLiqStatus.textContent = "✅ Liquidity removed!";
    await updateUI();
  } catch (e) {
    console.error("Remove liquidity error:", e);
    remLiqStatus.textContent = `❌ Error: ${e.reason || e.message || e}`;
  }
}

/**
 * @notice Mints test tokens for the user
 * @dev Only works with test tokens that have mint functionality
 * @param {string} tokenType Either 'A' or 'B' indicating which token to mint
 * @return {Promise<void>}
 */
async function mintTokens(tokenType) {
  if (!signer) {
    alert("Connect your wallet first.");
    return;
  }

  mintStatus.textContent = `Minting 100 Token ${tokenType}...`;
  
  try {
    const tokenAddress = tokenType === 'A' ? TOKEN_A : TOKEN_B;
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    
    const tx = await tokenContract.mint(
      await signer.getAddress(),
      ethers.parseUnits("100", 18)
    );
    await tx.wait();
    
    mintStatus.textContent = `✅ 100 Token ${tokenType} Minted!`;
    await updateUI();
  } catch (e) {
    console.error("Mint error:", e);
    mintStatus.textContent = `❌ Error: ${e.reason || e.message || e}`;
  }
}

/**
 * @notice Initializes the application
 * @dev Sets up event listeners and UI interactions
 * @return {Promise<void>}
 */
async function init() {
  // Set up tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Wallet connection
  connectBtn.onclick = async () => {
    try {
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      const address = await signer.getAddress();
      walletAddress.textContent = `✅ ${address.slice(0, 6)}...${address.slice(-4)}`;
      await updateUI();
    } catch (e) {
      alert("Error connecting wallet: " + (e.message || e));
    }
  };

  // Assign event handlers
  swapBtn.onclick = swapTokens;
  swapOrderBtn.onclick = swapTokenOrder;
  addLiqBtn.onclick = addLiquidity;
  remLiqBtn.onclick = removeLiquidity;
  document.getElementById("mintTokenABtn").onclick = () => mintTokens('A');
  document.getElementById("mintTokenBBtn").onclick = () => mintTokens('B');
}

// Start the application
init();